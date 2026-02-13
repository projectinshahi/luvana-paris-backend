const mongoose = require('mongoose');

const userAddressSchema = new mongoose.Schema({
    name: String,
    phone: String,
    email: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    country: String,
    postalCode: String,
    isDefault: Boolean,
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
},
{
    timestamps: true, 
});

const UserAddress = mongoose.model('UserAddress', userAddressSchema);

module.exports = UserAddress;