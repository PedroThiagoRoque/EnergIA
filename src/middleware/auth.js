// src/middleware/auth.js

function requireLogin(req, res, next) {
    if (!req.session.userId) {
      return res.redirect('/login'); // Redireciona para a página de login se não estiver autenticado
    }
    next(); // Caso contrário, prossegue para a rota solicitada
  }
  
  module.exports = requireLogin;  