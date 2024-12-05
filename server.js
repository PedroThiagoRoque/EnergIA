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
const requireLogin = require('./src/middleware/auth'); // Importando middleware de autenticação

//BD
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB conectado!"))
  .catch(err => console.error("Erro ao conectar ao MongoDB:", err));


app.use(bodyParser.urlencoded({ extended: true }));
const port = 3000;

app.use(express.json());

// Função para obter a temperatura da cidade de Pelotas usando OpenWeatherMap API
function getTemperature(callback) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  const lat = '-31.7692';
  const lon = '-52.3410';
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;

  https.get(url, (response) => {
    let data = '';

    // Receber os chunks de dados
    response.on('data', (chunk) => {
      data += chunk;
    });

    // Quando todos os dados forem recebidos
    response.on('end', () => {
      if (response.statusCode === 200) {
        const weatherData = JSON.parse(data);
        const temperature = Math.trunc(weatherData.main.temp);
        callback(null, temperature);
      } else {
        callback(`Erro ao obter temperatura: ${response.statusCode} - ${data}`, null);
      }
    });
  }).on('error', (err) => {
    callback(`Erro na requisição: ${err.message}`, null);
  });
}

//middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })); 

// Configurar EJS
app.set('view engine', 'ejs');

// Configurar diretório público
app.use(express.static('public'));
app.use('/public', express.static(path.join(__dirname, 'public')))

// Rota principal
app.get('/', (req, res) => res.render('home'));
app.use('/chat', requireLogin, chatRouter);
app.use('/editor', requireLogin, editorRouter);

// Rotas que requerem autenticação - Aplicando requireLogin
app.get('/editor', requireLogin, (req, res) => {
    res.render('editorprompt/editor', { response: '' });
  });

//Auth
app.use(authRouter);

// Dashboard
app.get('/dashboard', (req, res) => {
  // Obter a temperatura de Pelotas
  getTemperature((err, temperature) => {
    if (err) {
      console.error(err);
      temperature = 'N/A';
    }

    // Renderizar o dashboard com a temperatura obtida
    res.render('dashboard', {
      userName: req.session.userName,
      temperature: temperature // Passar temperatura para a view
    });
  });
});



///////////////////////////////////////////
// Iniciar servidor
app.listen(port, () => console.log(`Servidor rodando na porta ${port}!`));

//////////////////////////////