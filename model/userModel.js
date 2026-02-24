const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
    name: String,
    email: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    phone: String,
    password: {
      type: String,
      required: false,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    profilePicture: String,
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

userSchema.pre('save', async function (next) {
  const user = this;
  if (user.isModified('password')) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});

// Method to compare password during login
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to generate an access token
userSchema.methods.generateAccessToken = function () {
  return jwt.sign({ userId: this._id }, 'this_luvana756#', { expiresIn: '30d' });
};

const User = mongoose.model('User', userSchema);

module.exports = User;