const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    lastlogin: Date,
},
{
    timestamps: true, 
});

const User = mongoose.model('User', userSchema);

module.exports = User;