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
const weatherMiddleware = require('./src/middleware/weatherMiddleware'); // Importando middleware meteorológico

//BD
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB conectado!"))
  .catch(err => console.error("Erro ao conectar ao MongoDB:", err));


app.use(bodyParser.urlencoded({ extended: true }));
const port = 3000;

app.use(express.json());

// Função para obter dados meteorológicos completos da cidade de Pelotas usando OpenWeatherMap API
function getWeatherData(callback) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  const lat = '-31.7692';
  const lon = '-52.3410';
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;

  https.get(url, (response) => {
    let data = '';
    response.on('data', (chunk) => { data += chunk; });
    response.on('end', () => {
      if (response.statusCode === 200) {
        try {
          const weatherData = JSON.parse(data);

          // Estrutura completa de dados meteorológicos
          const weatherInfo = {
            temperature: Math.trunc(weatherData.main.temp),
            feelsLike: Math.trunc(weatherData.main.feels_like),
            humidity: weatherData.main.humidity,
            pressure: weatherData.main.pressure,
            windSpeed: weatherData.wind ? Math.round(weatherData.wind.speed * 3.6) : 0, // Converter m/s para km/h
            windDirection: weatherData.wind ? weatherData.wind.deg : 0,
            visibility: weatherData.visibility ? Math.round(weatherData.visibility / 1000) : 0, // Converter metros para km
            cloudiness: weatherData.clouds ? weatherData.clouds.all : 0,
            weather: {
              main: weatherData.weather && weatherData.weather[0] ? weatherData.weather[0].main : 'Clear',
              description: weatherData.weather && weatherData.weather[0] ? weatherData.weather[0].description : 'céu limpo',
              icon: weatherData.weather && weatherData.weather[0] ? weatherData.weather[0].icon : '01d'
            },
            sunrise: weatherData.sys ? new Date(weatherData.sys.sunrise * 1000) : null,
            sunset: weatherData.sys ? new Date(weatherData.sys.sunset * 1000) : null,
            timestamp: new Date(),
            location: {
              city: 'Pelotas',
              country: 'BR',
              coords: { lat, lon }
            }
          };

          // Adiciona dados de precipitação se disponível
          if (weatherData.rain) {
            weatherInfo.rain = weatherData.rain['1h'] || weatherData.rain['3h'] || 0;
          }
          if (weatherData.snow) {
            weatherInfo.snow = weatherData.snow['1h'] || weatherData.snow['3h'] || 0;
          }

          callback(null, weatherInfo);
        } catch (parseError) {
          callback(`Erro ao processar dados meteorológicos: ${parseError.message}`, null);
        }
      } else {
        callback(`Erro ao obter dados meteorológicos: ${response.statusCode} - ${data}`, null);
      }
    });
  }).on('error', (err) => {
    callback(`Erro na requisição meteorológica: ${err.message}`, null);
  });
}

// Mantém função getTemperature para compatibilidade com código existente
function getTemperature(callback) {
  getWeatherData((err, weatherData) => {
    if (err) {
      callback(err, null);
    } else {
      callback(null, {
        temperature: weatherData.temperature,
        icon: weatherData.weather.icon
      });
    }
  });
}

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
app.get('/dashboard', requireLogin, (req, res) => {
  getTemperature((err, weather) => {
    let temperature = '';
    let weatherIcon = '';
    if (!err && weather) {
      temperature = weather.temperature;
      weatherIcon = weather.icon;
    }
    res.render('dashboard', {
      userName: req.session.userName,
      temperature,
      weatherIcon
    });
  });
});



///////////////////////////////////////////
// Iniciar servidor
const { startProfileAnalysisJob } = require('./src/jobs/profileCron');
startProfileAnalysisJob();
app.listen(port, () => console.log(`Servidor rodando na porta ${port}!`));

//////////////////////////////