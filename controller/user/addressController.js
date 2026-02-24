const UserAddress = require('../../model/userAddressModel');

// Create new address
const createAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      type,
      name,
      phone,
      email,
      addressLine1,
      addressLine2,
      city,
      state,
      country,
      postalCode,
      isDefault
    } = req.body;

    if (!addressLine1 || !city || !country || !postalCode) {
      return res.status(400).json({ message: 'Address line 1, city, country, and postal code are required' });
    }

    if (isDefault === true) {
      await UserAddress.updateMany({ user: userId }, { $set: { isDefault: false } });
    }

    const existingCount = await UserAddress.countDocuments({ user: userId, status: 'active' });
    const shouldBeDefault = isDefault === true || existingCount === 0;

    const address = new UserAddress({
      user: userId,
      type,
      name,
      phone,
      email,
      addressLine1,
      addressLine2,
      city,
      state,
      country,
      postalCode,
      isDefault: shouldBeDefault,
      status: 'active'
    });

    const savedAddress = await address.save();

    res.status(201).json({
      message: 'Address created successfully',
      address: savedAddress
    });
  } catch (error) {
    console.error('Create address error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get all active addresses
const getAddresses = async (req, res) => {
  try {
    const userId = req.user._id;

    const addresses = await UserAddress.find({ user: userId, status: 'active' })
      .sort({ isDefault: -1, createdAt: -1 });

    res.json({
      addresses
    });
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get address by id
const getAddressById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { addressId } = req.params;

    const address = await UserAddress.findOne({
      _id: addressId,
      user: userId,
      status: 'active'
    });

    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    res.json({ address });
  } catch (error) {
    console.error('Get address error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update address
const updateAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { addressId } = req.params;
    const updates = req.body;

    if (updates.isDefault === true) {
      await UserAddress.updateMany({ user: userId }, { $set: { isDefault: false } });
    }

    const address = await UserAddress.findOneAndUpdate(
      { _id: addressId, user: userId, status: 'active' },
      { $set: updates },
      { new: true }
    );

    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    res.json({
      message: 'Address updated successfully',
      address
    });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete address (soft delete)
const deleteAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { addressId } = req.params;

    const address = await UserAddress.findOneAndUpdate(
      { _id: addressId, user: userId, status: 'active' },
      { $set: { status: 'inactive', isDefault: false } },
      { new: true }
    );

    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    res.json({ message: 'Address deleted successfully' });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  createAddress,
  getAddresses,
  getAddressById,
  updateAddress,
  deleteAddress
};
