// src/models/User.js

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true }, //
  email: { type: String, required: true, unique: true }, // Email usado como credencial de login
  password: { type: String, required: true },
  group: { type: String, required: true }, // Grupo ao qual o usuário pertence
  ageRange: { type: String, required: true }, // Faixa etária
  gender: { type: String, required: true }, // Gênero
  role: { type: String, enum: ['user', 'godmode'], default: 'user' }, // Role do usuário
  forcePasswordChange: { type: Boolean, default: false }, // Forçar troca de senha no próximo login
  perfilUsuario: { type: String, default: 'Intermediário' }, // Perfil comportamental: Descuidado, Intermediário, Proativo
  resumoUso: { type: String, default: '' }, // Resumo de padrões de uso e interação
  // Variáveis de uso separadas para análise de perfil
  dadosUso: {
    totalInteracoes: { type: Number, default: 0 },
    periodoPreferencial: { type: String, default: '' }, // manhã, tarde, noite
    temasInteresse: [{ type: String }], // iluminação, climatização, eletrodomésticos, etc
    frequenciaUso: { type: String, default: 'novo' }, // novo, ocasional, frequente
    duracaoMediaSessao: { type: Number, default: 0 }, // em minutos
    perguntasTecnicas: { type: Number, default: 0 }, // quantidade de perguntas técnicas
    perguntasBasicas: { type: Number, default: 0 }, // quantidade de perguntas básicas
    engajamentoDesafios: { type: Number, default: 0 }, // aceita desafios/dicas
    ultimaInteracao: { type: Date, default: Date.now }
  }
});

module.exports = mongoose.model('User', UserSchema);
