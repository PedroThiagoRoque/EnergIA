const express = require('express');
const https = require('https');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');

require('dotenv').config();

// Importe os módulos de rota
const chatRouter = require('./src/routes/chat');
const editorRouter = require('./src/routes/editor');
const authRouter = require('./src/routes/auth');
const adminRouter = require('./src/routes/admin'); // Rota de Admin
const { requireLogin } = require('./src/middleware/auth'); // Importando middleware de autenticação
const weatherMiddleware = require('./src/middleware/weatherMiddleware'); // Importando middleware meteorológico
const { getWeatherData, getTemperature } = require('./src/services/weatherService');

//BD
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB conectado!"))
  .catch(err => console.error("Erro ao conectar ao MongoDB:", err));


app.use(bodyParser.urlencoded({ extended: true }));
const port = 3000;

app.use(express.json());

// Weather functions imported from src/services/weatherService.js

//middleware
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));

// Middleware para dados meteorológicos (aplicado globalmente para rotas autenticadas)
app.use(weatherMiddleware(getWeatherData));

// Configurar EJS
app.set('view engine', 'ejs');

// Configurar diretório público
app.use(express.static('public'));
app.use('/public', express.static(path.join(__dirname, 'public')))

// Rota principal
app.use('/', authRouter); // Disponibiliza login, register, logout
app.get('/', (req, res) => res.render('home'));
app.use('/chat', requireLogin, chatRouter);
app.use('/editor', requireLogin, editorRouter);
app.use('/admin', adminRouter); // Rota de Admin (já possui middleware interno)

// Rotas que requerem autenticação - Aplicando requireLogin
app.get('/dashboard', requireLogin, (req, res) => {
  const { getTemperature } = require('./src/services/weatherService');
  getTemperature((err, weather) => {
    let temperature = '--';
    let weatherIcon = '';
    if (!err && weather) {
      temperature = weather.temperature;
      weatherIcon = weather.icon;
    }
    res.render('dashboard', {
      userName: req.session.userName,
      temperature,
      weatherIcon,
      role: req.session.role // Passando a role para a view
    });
  });
});


///////////////////////////////////////////
// Iniciar servidor
const { startProfileAnalysisJob } = require('./src/jobs/profileCron');
const { startDailyContentJob } = require('./src/jobs/dailyCron');
startProfileAnalysisJob();
startDailyContentJob();
app.listen(port, () => console.log(`Servidor rodando na porta ${port}!`));

//////////////////////////////