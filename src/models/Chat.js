// src/models/Chat.js

const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  threadId: { type: String, required: true },
  activeRunId: { type: String, default: null },
  messages: [
    {
      sender: { type: String, enum: ['user', 'assistant'], required: true },
      content: { type: String, required: true },
      timestamp: { type: Date, default: Date.now }
    }
  ],
});

module.exports = mongoose.model('Chat', ChatSchema);
