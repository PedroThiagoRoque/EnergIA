const cron = require('node-cron');
const User = require('../models/User');
const { calculaPerfilUsuarioComAnalisePerfilAssistant } = require('../services/profileAnalysis');

function startProfileAnalysisJob() {
    // Executa todo dia as 07:00
    cron.schedule('0 7 * * *', async () => {
        console.log('[CRON] Iniciando análise diária de perfis de usuários...');

        try {
            const users = await User.find({});
            console.log(`[CRON] Encontrados ${users.length} usuários para análise.`);

            for (const user of users) {
                // Verifica se tem dados de uso para analisar
                if (!user.dadosUso) {
                    console.log(`[CRON] Usuário ${user.email} sem dados de uso. Pulando.`);
                    continue;
                }

                try {
                    // Chama o serviço extraído
                    const novoPerfil = await calculaPerfilUsuarioComAnalisePerfilAssistant(user.dadosUso);

                    // Atualiza usuário se mudou ou se apenas queremos registrar a análise
                    await User.findByIdAndUpdate(user._id, {
                        perfilUsuario: novoPerfil,
                        'dadosUso.ultimoCalculoPerfil': new Date().toISOString(),
                        perfilAtualizadoEm: new Date()
                    });

                    console.log(`[CRON] Usuário ${user.email} atualizado para perfil: ${novoPerfil}`);

                    // Pequeno delay para não estourar rate limits da OpenAI se houver muitos usuários
                    await new Promise(r => setTimeout(r, 1000));
                } catch (innerErr) {
                    console.error(`[CRON] Erro ao analisar usuário ${user.email}:`, innerErr);
                }
            }
            console.log('[CRON] Análise diária finalizada.');
        } catch (err) {
            console.error('[CRON] Erro crítico na execução do job:', err);
        }
    });

    console.log('[CRON] Job de análise de perfil agendado para 07:00.');
}

module.exports = { startProfileAnalysisJob };
