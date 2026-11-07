const mongoose = require('mongoose');

// Short-lived one-time codes for the Google OAuth handoff.
// The TTL index (`expires`) lets MongoDB auto-delete documents after 5 minutes,
// so no manual cleanup is needed. Works across all PM2 worker processes.
const authCodeSchema = new mongoose.Schema({
  code:  { type: String, required: true, index: true },
  token: { type: String, required: true },
  user:  { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 }, // 5-minute TTL
});

module.exports = mongoose.model('AuthCode', authCodeSchema);
