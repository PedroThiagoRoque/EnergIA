const cron = require('node-cron');
const { getWeatherData } = require('../services/weatherService');
const { gerarEGravarDailyContent } = require('../services/dailyContent');

function startDailyContentJob() {
    // Executa todo dia as 07:00
    cron.schedule('0 7 * * *', () => {
        console.log('[DailyCron] Iniciando geração de conteúdo diário (Icebreakers + Dicas)...');

        getWeatherData(async (err, weather) => {
            try {
                const clima = (!err && weather) ? weather : { temperature: 20, description: 'indefinido' }; // fallback seguro
                // Usamos um perfil 'Intermediário' genérico para gerar o conteúdo global do dia
                const perfilGenerico = 'Intermediário';

                const doc = await gerarEGravarDailyContent(perfilGenerico, clima);
                console.log(`[DailyCron] Conteúdo diário gerado para ${doc.date}`);
            } catch (error) {
                console.error('[DailyCron] Erro fatal ao gerar conteúdo:', error);
            }
        });
    });

    console.log('[DailyCron] Job de conteúdo diário agendado para 07:00.');
}

module.exports = { startDailyContentJob };
