const Order = require('../../model/orderModel');
const User = require('../../model/userModel');
const Product = require('../../model/productModel');
const ProductVariants = require('../../model/productVariantsModel');

// Get dashboard metrics and data
const getDashboard = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.createdAt.$lte = new Date(endDate);
      }
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const previousPeriodStart = new Date(sevenDaysAgo);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);

    // Run all independent DB queries in parallel
    const [
      totalOrders,
      totalUsers,
      totalProducts,
      totalActiveUsers,
      salesData,
      recentOrders,
      topSellingProducts,
      orderStatusBreakdown,
      paymentStatusBreakdown,
      ordersByDate,
      previousPeriodOrders,
      currentPeriodOrders,
      previousPeriodSales,
    ] = await Promise.all([
      Order.countDocuments(dateFilter),
      User.countDocuments({}),
      Product.countDocuments({ status: 'active' }),
      User.countDocuments({ status: 'active' }),
      Order.aggregate([
        { $match: { ...dateFilter, paymentStatus: 'paid' } },
        { $group: { _id: null, totalSales: { $sum: '$price' }, totalDiscount: { $sum: '$discount' }, totalShipping: { $sum: '$shippingCharges' } } }
      ]),
      Order.find(dateFilter)
        .populate('user', 'name email phone')
        .populate('orderItem.product', 'nameEnglish nameArabic')
        .sort({ createdAt: -1 })
        .limit(10),
      Order.aggregate([
        { $match: { ...dateFilter, paymentStatus: 'paid' } },
        { $unwind: '$orderItem' },
        { $group: { _id: '$orderItem.product', totalQuantity: { $sum: '$orderItem.quantity' }, totalRevenue: { $sum: { $multiply: ['$orderItem.quantity', '$orderItem.price'] } }, productName: { $first: '$orderItem.productNameEnglish' }, productNameArabic: { $first: '$orderItem.productNameArabic' } } },
        { $sort: { totalQuantity: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'productDetails' } },
        { $addFields: { productDetails: { $arrayElemAt: ['$productDetails', 0] } } }
      ]),
      Order.aggregate([{ $match: dateFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Order.aggregate([{ $match: dateFilter }, { $group: { _id: '$paymentStatus', count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo }, paymentStatus: 'paid' } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 }, revenue: { $sum: '$price' } } },
        { $sort: { _id: 1 } }
      ]),
      Order.countDocuments({ createdAt: { $gte: previousPeriodStart, $lt: sevenDaysAgo } }),
      Order.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Order.aggregate([
        { $match: { createdAt: { $gte: previousPeriodStart, $lt: sevenDaysAgo }, paymentStatus: 'paid' } },
        { $group: { _id: null, totalSales: { $sum: '$price' } } }
      ]),
    ]);

    const totalSalesAmount = salesData[0]?.totalSales || 0;
    const totalDiscount = salesData[0]?.totalDiscount || 0;
    const totalShipping = salesData[0]?.totalShipping || 0;

    const formattedRecentOrders = recentOrders.map(order => ({
      id: order._id,
      orderId: order.orderId,
      customerName: order.user?.name || 'Unknown',
      customerEmail: order.user?.email,
      amount: order.price,
      discount: order.discount,
      shippingCharges: order.shippingCharges,
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
      orderItems: (order.orderItem || []).map(item => ({
        product: item.product?._id,
        productName: item.productNameEnglish || item.product?.nameEnglish || 'Unknown',
        quantity: item.quantity,
        price: item.price
      })),
      date: order.createdAt
    }));

    const formattedTopProducts = topSellingProducts.map(product => ({
      productId: product._id,
      productName: product.productName || product.productDetails?.nameEnglish || 'Unknown',
      productNameArabic: product.productNameArabic || product.productDetails?.nameArabic,
      totalQuantity: product.totalQuantity,
      totalRevenue: product.totalRevenue,
      imageUrl: product.productDetails?.imageUrlEnglish?.[0]?.imageUrl
    }));

    const statusBreakdown = {};
    orderStatusBreakdown.forEach(item => { statusBreakdown[item._id] = item.count; });

    const paymentBreakdown = {};
    paymentStatusBreakdown.forEach(item => { paymentBreakdown[item._id] = item.count; });

    const orderGrowth = previousPeriodOrders > 0
      ? (((currentPeriodOrders - previousPeriodOrders) / previousPeriodOrders) * 100).toFixed(2)
      : 100;

    const previousSalesAmount = previousPeriodSales[0]?.totalSales || 0;
    const salesGrowth = previousSalesAmount > 0
      ? (((totalSalesAmount - previousSalesAmount) / previousSalesAmount) * 100).toFixed(2)
      : 100;

    res.json({
      metrics: {
        totalOrders,
        totalUsers,
        totalActiveUsers,
        totalProducts,
        totalSalesAmount: Number(totalSalesAmount.toFixed(2)),
        totalDiscount: Number(totalDiscount.toFixed(2)),
        totalShipping: Number(totalShipping.toFixed(2)),
        averageOrderValue: totalOrders > 0 ? Number((totalSalesAmount / totalOrders).toFixed(2)) : 0
      },
      growth: {
        orderGrowth: Number(orderGrowth),
        salesGrowth: Number(salesGrowth)
      },
      recentOrders: formattedRecentOrders,
      topSellingProducts: formattedTopProducts,
      orderStatusBreakdown: statusBreakdown,
      paymentStatusBreakdown: paymentBreakdown,
      ordersByDate,
      dateRange: {
        startDate: dateFilter.createdAt?.$gte || 'N/A',
        endDate: dateFilter.createdAt?.$lte || 'N/A'
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

module.exports = {
  getDashboard
};
