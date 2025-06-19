// src/models/User.js

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true }, //
  email: { type: String, required: true, unique: true }, // Email usado como credencial de login
  password: { type: String, required: true },
  group: { type: String, required: true }, // Grupo ao qual o usuário pertence
  ageRange: { type: String, required: true }, // Faixa etária
  gender: { type: String, required: true } // Gênero
  
});

module.exports = mongoose.model('User', UserSchema);
