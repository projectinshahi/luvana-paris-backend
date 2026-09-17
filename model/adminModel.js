const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Admin Model

const adminSchema = new mongoose.Schema({
    name: String,
    email: {
        type: String,
        unique: true,
        required: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    // role: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Role',
    //     required: true
    // },
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

adminSchema.pre('save', async function (next) {
  const admin = this;
  if (admin.isModified('password')) {
    admin.password = await bcrypt.hash(admin.password, 10);
  }
});

// Method to compare password during login
adminSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to generate an access token
adminSchema.methods.generateAccessToken = function () {
  return jwt.sign({ userId: this._id }, 'this_luvana756#', { expiresIn: '15d' });
  // return jwt.sign({ userId: this._id, role: this.role }, 'this_luvana756#', { expiresIn: '15d' });
};

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;