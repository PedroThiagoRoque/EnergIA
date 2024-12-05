// src/routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Tela de Registro
router.get('/register', (req, res) => res.render('register'));

// Registro de Novo Usuário
router.post('/register', async (req, res) => {
  const { name, email, password, group, ageRange, gender } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const newUser = await User.create({
      name, // Nome do usuário
      email, // Email do usuário
      password: hashedPassword,
      group,
      ageRange,
      gender,
    });
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    res.render('register', { error: "Erro ao criar usuário" });
  }
});

// Tela de Login
router.get('/login', (req, res) => res.render('login'));

// Login de Usuário Existente
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email }); // Buscar pelo email
    if (user && await bcrypt.compare(password, user.password)) {
      req.session.userId = user._id; // Criar a sessão do usuário
      req.session.userName = user.name; // Armazenar o nome do usuário para saudação
      res.redirect('/dashboard'); // Redirecionar para o dashboard
    } else {
      res.render('login', { error: "Credenciais inválidas" });
    }
  } catch (err) {
    console.error(err);
    res.render('login', { error: "Ocorreu um erro. Tente novamente." });
  }
});

module.exports = router;
