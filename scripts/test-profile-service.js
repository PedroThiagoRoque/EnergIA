require('dotenv').config();
const { calculaPerfilUsuarioComAnalisePerfilAssistant } = require('../src/services/profileAnalysis');

const mockDadosUso = {
    totalInteracoes: 10,
    periodoPreferencial: 'noite',
    temasInteresse: ['iluminação', 'ar-condicionado'],
    frequenciaUso: 'frequente',
    duracaoMediaSessao: 5,
    perguntasTecnicas: 2,
    perguntasBasicas: 8,
    engajamentoDesafios: 1,
    ultimaInteracao: new Date()
};

console.log('Iniciando teste de análise de perfil...');

calculaPerfilUsuarioComAnalisePerfilAssistant(mockDadosUso)
    .then(perfil => {
        console.log('Teste concluído com sucesso!');
        console.log('Perfil retornado:', perfil);
        process.exit(0);
    })
    .catch(err => {
        console.error('Erro no teste:', err);
        process.exit(1);
    });
