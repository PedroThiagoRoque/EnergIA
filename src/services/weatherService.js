const https = require('https');
require('dotenv').config();

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

function getWeatherFromRequest(req) {
    // Tenta várias fontes em ordem de preferência
    // Nota: weatherMiddleware salva em req.session.weatherData
    const raw =
        req?.session?.weatherData ??
        req?.session?.weather ??
        req?.session?.clima ??
        req?.weather ??
        req?.res?.locals?.weather ??
        req?.locals?.weather ??
        null;

    if (!raw) return null;

    // Normalização de campos comuns
    const temp = raw.temperature ?? raw.temp ?? raw.main?.temp ?? raw.current?.temp;
    const hum = raw.humidity ?? raw.main?.humidity ?? raw.current?.humidity;
    const desc = raw.description ?? raw.weather?.description ?? raw.weather?.[0]?.description ?? raw.summary;
    const icon = raw.icon ?? raw.weather?.icon ?? raw.weather?.[0]?.icon ?? null;
    const city = raw.city ?? raw.name ?? raw.location?.city ?? raw.sys?.country ?? null;
    const when = raw.when ?? raw.dt_iso ?? raw.time ?? new Date().toISOString();

    return {
        temperature: typeof temp === 'number' ? Math.round(temp) : (temp ?? null),
        humidity: hum ?? null,
        weather: { description: desc ?? 'indisponível', icon },
        city,
        when,
        _raw: raw, // útil para depuração
    };
}

module.exports = { getWeatherData, getTemperature, getWeatherFromRequest };
