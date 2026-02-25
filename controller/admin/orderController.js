const Order = require('../../model/orderModel');
const User = require('../../model/userModel');

// Get all orders with pagination, filtering, and search
const getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Filter by order status
    if (status) {
      query.status = status;
    }

    // Filter by payment status
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    // Search by order ID or customer details
    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');

      const userIds = users.map(user => user._id);

      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { user: { $in: userIds } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('shippingAddress')
      .populate('coupon', 'code discount')
      .populate('orderItem.product', 'nameEnglish nameArabic')
      .populate('orderItem.variant', 'size color price')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const totalOrders = await Order.countDocuments(query);

    res.json({
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalOrders / parseInt(limit)),
        totalOrders,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get single order by ID
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id)
      .populate('user', 'name email phone')
      .populate('shippingAddress')
      .populate('coupon', 'code discount minimumPurchase')
      .populate('orderItem.product', 'nameEnglish nameArabic imageUrlEnglish imageUrlArabic')
      .populate('orderItem.variant', 'size color price mrp stock');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ order });
  } catch (error) {
    console.error('Get order by ID error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Invalid status',
        validStatuses
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = status;
    await order.save();

    const updatedOrder = await Order.findById(id)
      .populate('user', 'name email phone')
      .populate('shippingAddress')
      .populate('coupon', 'code discount')
      .populate('orderItem.product', 'nameEnglish nameArabic')
      .populate('orderItem.variant', 'size color price');

    res.json({
      message: 'Order status updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update payment status
const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];
    
    if (!paymentStatus || !validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        message: 'Invalid payment status',
        validPaymentStatuses
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.paymentStatus = paymentStatus;
    await order.save();

    const updatedOrder = await Order.findById(id)
      .populate('user', 'name email phone')
      .populate('shippingAddress')
      .populate('coupon', 'code discount')
      .populate('orderItem.product', 'nameEnglish nameArabic')
      .populate('orderItem.variant', 'size color price');

    res.json({
      message: 'Payment status updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete order (soft delete by setting to cancelled)
const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Instead of deleting, update status to cancelled
    order.status = 'cancelled';
    await order.save();

    res.json({ message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get order statistics for dashboard
const getOrderStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Total orders
    const totalOrders = await Order.countDocuments(dateFilter);

    // Orders by status
    const ordersByStatus = await Order.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Orders by payment status
    const ordersByPaymentStatus = await Order.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$paymentStatus', count: { $sum: 1 } } }
    ]);

    // Total revenue (only paid orders)
    const revenueData = await Order.aggregate([
      { $match: { ...dateFilter, paymentStatus: 'paid' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$price' },
          totalDiscount: { $sum: '$discount' },
          totalShipping: { $sum: '$shippingCharges' }
        }
      }
    ]);

    // Recent orders
    const recentOrders = await Order.find(dateFilter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('orderId status paymentStatus price createdAt');

    // Top customers by order count
    const topCustomers = await Order.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$user', orderCount: { $sum: 1 }, totalSpent: { $sum: '$price' } } },
      { $sort: { orderCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      { $unwind: '$userDetails' },
      {
        $project: {
          _id: 1,
          orderCount: 1,
          totalSpent: 1,
          userName: '$userDetails.name',
          userEmail: '$userDetails.email'
        }
      }
    ]);

    res.json({
      totalOrders,
      ordersByStatus: ordersByStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      ordersByPaymentStatus: ordersByPaymentStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      revenue: revenueData[0] || { totalRevenue: 0, totalDiscount: 0, totalShipping: 0 },
      recentOrders,
      topCustomers
    });
  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
  deleteOrder,
  getOrderStats
};
