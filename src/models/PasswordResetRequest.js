const mongoose = require('mongoose');

const PasswordResetRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    email: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PasswordResetRequest', PasswordResetRequestSchema);
