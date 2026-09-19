const User = require('../../model/userModel');
const Order = require('../../model/orderModel');

// Get all users with pagination, search, and filter
const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Search by name, email, or phone
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    // Tiebreak on _id: sorting by a field with repeated values (status, name...)
    // is not a total order, and skip/limit over one hides rows from every page.
    sort._id = -1;

    const users = await User.find(query)
      .select('-password')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const totalUsers = await User.countDocuments(query);

    res.json({
      customers: users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalUsers / parseInt(limit)),
        totalCustomers: totalUsers,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get single user by ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user orders
    const orders = await Order.find({ user: id })
      .populate('coupon', 'code discount')
      .populate('orderItem.product', 'nameEnglish nameArabic')
      .populate('orderItem.variant', 'nameEnglish nameArabic size color price mrp stock imageUrlEnglish imageUrlArabic')
      .sort({ createdAt: -1, _id: -1 });

    // Calculate total orders count
    const totalOrdersCount = orders.length;

    // Calculate total spent (only confirmed/completed orders with paid status)
    const totalSpent = orders
      .filter(order => order.paymentStatus === 'paid')
      .reduce((sum, order) => sum + (order.price || 0), 0);

    res.json({
      user,
      orders: {
        list: orders,
        totalCount: totalOrdersCount,
        totalSpent: Number(totalSpent.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update user status
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['active', 'inactive'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Invalid status',
        validStatuses
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.status = status;
    await user.save();

    const updatedUser = await User.findById(id).select('-password');

    res.json({
      message: 'User status updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete user (soft delete by setting to inactive)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Instead of deleting, set status to inactive
    user.status = 'inactive';
    await user.save();

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get user statistics
const getUserStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Total users
    const totalUsers = await User.countDocuments(dateFilter);

    // Users by status
    const usersByStatus = await User.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Total active users
    const activeUsers = await User.countDocuments({ ...dateFilter, status: 'active' });

    // Total inactive users
    const inactiveUsers = await User.countDocuments({ ...dateFilter, status: 'inactive' });

    // Recent registrations
    const recentUsers = await User.find(dateFilter)
      .select('name email status createdAt')
      // _id tiebreaks so the same 5 come back on every refresh.
      .sort({ createdAt: -1, _id: -1 })
      .limit(5);

    // Users registered today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const usersRegisteredToday = await User.countDocuments({
      createdAt: {
        $gte: today,
        $lt: tomorrow
      }
    });

    res.json({
      totalUsers,
      activeUsers,
      inactiveUsers,
      usersByStatus: usersByStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      recentUsers,
      usersRegisteredToday
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUserStatus,
  deleteUser,
  getUserStats
};
