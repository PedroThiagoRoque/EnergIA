// src/models/User.js

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  group: { type: String, required: true },  // Campo que pode ser usado para definir o grupo ao qual o usuário pertence
  ageRange: { type: String, required: true },  // Faixas de idade, por exemplo: '18-25', '26-35', etc.
  gender: { type: String, required: true },  // 'male', 'female', 'non-binary', etc.
});

module.exports = mongoose.model('User', UserSchema);
