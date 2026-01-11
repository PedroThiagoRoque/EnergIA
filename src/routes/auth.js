// src/routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const PasswordResetRequest = require('../models/PasswordResetRequest');
const bcrypt = require('bcryptjs');

// Tela de Registro
router.get('/register', (req, res) => res.render('register'));

// Registro de Novo Usuário
router.post('/register', async (req, res) => {
  const { name, email, password, group, ageRange, gender, vinculo } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const newUser = await User.create({
      name, // Nome do usuário
      email, // Email do usuário
      password: hashedPassword,
      group,
      ageRange,
      gender,
      vinculo,
      respostasFormularioInicial: { _placeholder: true },
      respostasFormularioFinal: { _placeholder: true }
    });
    res.redirect('/login?registered=true');
  } catch (err) {
    console.error(err);
    res.render('register', { error: "Erro ao criar usuário" });
  }
});

// Tela de Login
router.get('/login', (req, res) => {
  const registered = req.query.registered === 'true';
  res.render('login', {
    success: registered ? 'Cadastro realizado com sucesso! Faça login.' : null,
    error: null
  });
});

// Login de Usuário Existente
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email }); // Buscar pelo email
    if (user && await bcrypt.compare(password, user.password)) {
      req.session.userId = user._id; // Criar a sessão do usuário
      req.session.userId = user._id; // Criar a sessão do usuário
      req.session.userName = user.name; // Armazenar o nome do usuário para saudação
      req.session.role = user.role; // Armazena a role do usuário (user/godmode)

      // Verifica força de troca de senha
      if (user.forcePasswordChange) {
        return res.redirect('/change-password');
      }

      res.redirect('/dashboard'); // Redirecionar para o dashboard
    } else {
      res.render('login', { error: "Credenciais inválidas" });
    }
  } catch (err) {
    console.error(err);
    res.render('login', { error: "Ocorreu um erro. Tente novamente." });
  }
});

// Rota de Logout
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Erro ao encerrar sessão:', err);
      // Opcional: mostrar mensagem de erro ao usuário
      return res.redirect('/dashboard');
    }
    res.clearCookie('connect.sid'); // Limpa o cookie da sessão
    res.redirect('/login');
  });
});

// Troca de Senha (GET)
router.get('/change-password', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.render('change_password', { error: null, success: null });
});

// Troca de Senha (POST)
router.post('/change-password', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const { currentPassword, newPassword, confirmNewPassword } = req.body;
  const userId = req.session.userId;

  if (newPassword !== confirmNewPassword) {
    return res.render('change_password', { error: 'As novas senhas não conferem.', success: null });
  }

  try {
    const user = await User.findById(userId);

    // Se forcePasswordChange for true, 'currentPassword' seria a temporária. 
    // Vamos validar 'currentPassword' sempre para garantir segurança, 
    // exceto se quisermos simplificar. O ideal é validar.
    if (!await bcrypt.compare(currentPassword, user.password)) {
      return res.render('change_password', { error: 'Senha atual incorreta.', success: null });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.forcePasswordChange = false; // Remove a flag
    await user.save();

    res.render('change_password', { error: null, success: 'Senha alterada com sucesso! Você já pode ir para o dashboard.' });
  } catch (err) {
    console.error(err);
    res.render('change_password', { error: 'Erro ao alterar senha.', success: null });
  }
});

module.exports = router;

// Recuperação de Senha (GET)
router.get('/forgot-password', (req, res) => res.render('forgot_password'));

// Recuperação de Senha (POST)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user) {
      // Verifica se já existe solicitação
      const existing = await PasswordResetRequest.findOne({ userId: user._id });
      if (!existing) {
        await PasswordResetRequest.create({ userId: user._id, email: user.email });
      }
    }
    // Sempre retorna sucesso por segurança
    res.render('forgot_password', {
      success: 'Solicitação enviada! O administrador foi notificado.',
      error: null
    });
  } catch (err) {
    console.error(err);
    res.render('forgot_password', { error: 'Erro ao processar solicitação.', success: null });
  }
});
