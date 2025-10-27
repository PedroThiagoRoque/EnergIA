// src/middleware/weatherMiddleware.js

// Middleware para adicionar dados meteorológicos à sessão
const weatherMiddleware = (getWeatherDataFunction) => {
  return (req, res, next) => {
    // Verifica se já temos dados climáticos na sessão e se são recentes (menos de 30 minutos)
    const agora = new Date();
    const dadosExistentes = req.session.weatherData;
    
    if (dadosExistentes && dadosExistentes.timestamp) {
      const tempoDecorrido = agora - new Date(dadosExistentes.timestamp);
      const minutosDecorridos = tempoDecorrido / (1000 * 60);

      // Se os dados são recentes (menos de 120 minutos), usa o cache
      if (minutosDecorridos < 120) {
        console.log('Usando dados meteorológicos do cache da sessão');
        return next();
      }
    }

    // Busca novos dados meteorológicos
    console.log('Atualizando dados meteorológicos na sessão...');
    getWeatherDataFunction((err, weatherData) => {
      if (!err && weatherData) {
        // Adiciona dados meteorológicos à sessão
        req.session.weatherData = weatherData;
        console.log('Dados meteorológicos atualizados na sessão:', {
          temperature: weatherData.temperature,
          description: weatherData.weather.description,
          humidity: weatherData.humidity,
          timestamp: weatherData.timestamp
        });
      } else {
        console.error('Erro ao obter dados meteorológicos:', err);
        
        // Mantém dados antigos se existirem, ou cria dados padrão
        if (!req.session.weatherData) {
          req.session.weatherData = {
            temperature: 20,
            feelsLike: 20,
            humidity: 50,
            weather: {
              main: 'Clear',
              description: 'tempo estável',
              icon: '01d'
            },
            timestamp: agora,
            location: {
              city: 'Pelotas',
              country: 'BR'
            },
            fallback: true
          };
        }
      }
      
      next();
    });
  };
};

module.exports = weatherMiddleware;