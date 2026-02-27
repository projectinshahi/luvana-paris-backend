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

    // 1. Get total counts
    const totalOrders = await Order.countDocuments(dateFilter);
    const totalUsers = await User.countDocuments({});
    const totalProducts = await Product.countDocuments({ status: 'active' });
    const totalActiveUsers = await User.countDocuments({ status: 'active' });

    // 2. Get total sales amount (paid orders only)
    const salesData = await Order.aggregate([
      {
        $match: {
          ...dateFilter,
          paymentStatus: 'paid'
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$price' },
          totalDiscount: { $sum: '$discount' },
          totalShipping: { $sum: '$shippingCharges' }
        }
      }
    ]);

    const totalSalesAmount = salesData[0]?.totalSales || 0;
    const totalDiscount = salesData[0]?.totalDiscount || 0;
    const totalShipping = salesData[0]?.totalShipping || 0;

    // 3. Get recent orders (last 10)
    const recentOrders = await Order.find(dateFilter)
      .populate('user', 'name email phone')
      .populate('orderItem.product', 'nameEnglish nameArabic')
      .sort({ createdAt: -1 })
      .limit(10);

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

    // 4. Get top selling products
    const topSellingProducts = await Order.aggregate([
      {
        $match: {
          ...dateFilter,
          paymentStatus: 'paid'
        }
      },
      { $unwind: '$orderItem' },
      {
        $group: {
          _id: '$orderItem.product',
          totalQuantity: { $sum: '$orderItem.quantity' },
          totalRevenue: { $sum: { $multiply: ['$orderItem.quantity', '$orderItem.price'] } },
          productName: { $first: '$orderItem.productNameEnglish' },
          productNameArabic: { $first: '$orderItem.productNameArabic' }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      {
        $addFields: {
          productDetails: { $arrayElemAt: ['$productDetails', 0] }
        }
      }
    ]);

    const formattedTopProducts = topSellingProducts.map(product => ({
      productId: product._id,
      productName: product.productName || product.productDetails?.nameEnglish || 'Unknown',
      productNameArabic: product.productNameArabic || product.productDetails?.nameArabic,
      totalQuantity: product.totalQuantity,
      totalRevenue: product.totalRevenue,
      imageUrl: product.productDetails?.imageUrlEnglish?.[0]?.imageUrl
    }));

    // 5. Get order status breakdown
    const orderStatusBreakdown = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusBreakdown = {};
    orderStatusBreakdown.forEach(item => {
      statusBreakdown[item._id] = item.count;
    });

    // 6. Get payment status breakdown
    const paymentStatusBreakdown = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    const paymentBreakdown = {};
    paymentStatusBreakdown.forEach(item => {
      paymentBreakdown[item._id] = item.count;
    });

    // 7. Get orders by date for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const ordersByDate = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
          paymentStatus: 'paid'
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 },
          revenue: { $sum: '$price' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 8. Calculate growth metrics
    const previousPeriodStart = new Date(sevenDaysAgo);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);

    const previousPeriodOrders = await Order.countDocuments({
      createdAt: {
        $gte: previousPeriodStart,
        $lt: sevenDaysAgo
      }
    });

    const currentPeriodOrders = await Order.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    const orderGrowth = previousPeriodOrders > 0 
      ? (((currentPeriodOrders - previousPeriodOrders) / previousPeriodOrders) * 100).toFixed(2)
      : 100;

    // Get previous period sales
    const previousPeriodSales = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: previousPeriodStart,
            $lt: sevenDaysAgo
          },
          paymentStatus: 'paid'
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$price' }
        }
      }
    ]);

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
