// src/routes/auth.js

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');

// Tela de Login
router.get('/login', (req, res) => res.render('login'));

// Login de Usuário Existente
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && await bcrypt.compare(password, user.password)) {
      req.session.userId = user._id; // Criando sessão com ID do usuário
      res.redirect('/');
    } else {
      res.render('login', { error: "Credenciais inválidas" });
    }
  } catch (err) {
    console.error(err);
    res.render('login', { error: "Ocorreu um erro. Tente novamente." });
  }
});

// Registro de Novo Usuário
router.get('/register', (req, res) => res.render('register'));

router.post('/register', async (req, res) => {
  const { username, email, password, group, ageRange, gender } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const newUser = await User.create({
      username,
      email,
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

module.exports = router;
