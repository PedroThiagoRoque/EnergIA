// src/middleware/auth.js

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login'); // Redireciona para a página de login se não estiver autenticado
  }
  next(); // Caso contrário, prossegue para a rota solicitada
}

function requireAdmin(req, res, next) {
  if (req.session.role !== 'godmode') {
    return res.status(403).send('Acesso negado: Requer privilégios de administrador.');
  }
  next();
}

module.exports = { requireLogin, requireAdmin };  