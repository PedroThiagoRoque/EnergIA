// src/models/Chat.js

const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  threadId: { type: String, required: true },  // Adiciona o threadId como um campo obrigatório
  messages: [
    {
      sender: { type: String, enum: ['user', 'assistant'], required: true }, // Corrigido 'bot' para 'assistant'
      content: { type: String, required: true },  // Alterado de 'message' para 'content' para manter consistência com o código do chat
      timestamp: { type: Date, default: Date.now }
    }
  ],
});

module.exports = mongoose.model('Chat', ChatSchema);
