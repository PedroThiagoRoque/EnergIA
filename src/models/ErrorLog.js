const mongoose = require('mongoose');

const ErrorLogSchema = new mongoose.Schema({
    message: { type: String, required: true },
    stack: { type: String },
    route: { type: String },
    user: { type: String }, // ID do usuário ou 'anônimo'
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ErrorLog', ErrorLogSchema);
