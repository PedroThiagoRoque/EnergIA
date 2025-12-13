require('dotenv').config();
const DailyData = require('../models/DailyData');
const {
    getOrCreateAssistantEficiencia,
    runAssistantOnThread,
    combinarContextos,
    toText,
    addMessageToThread
} = require('./aiHelper');
const { openai } = require('./aiHelper');


const VECTOR_STORE_ID = process.env.VECTOR_STORE_ID;

function gerarIcebreakersLocais(perfil, weather) {
    const base = [
        'Iluminação LED por cômodo',
        'Uso de termostatos inteligentes',
        'Isolamento térmico eficaz',
        'Aproveitamento de luz natural',
        'Desumidificação com ventilação',
        'Energias renováveis no telhado',
        'Equipamentos Classe A',
        'Desligar aparelhos em modo stand by',
        'Reduzir temperaturas de aquecimento',
        'Uso consciente da água quente'
    ];

    if ((perfil || '').toLowerCase() === 'proativo') {
        return base.slice(0, 10).map(t => `${t} — desafio prático`);
    }
    if ((perfil || '').toLowerCase() === 'descuidado') {
        return base.slice(0, 8);
    }
    return base.slice(0, 10);
}

async function gerarIcebreakersRAGorLocal(perfil, weather) {
    const vectorStoreEnabled = !!VECTOR_STORE_ID;
    if (!vectorStoreEnabled) return gerarIcebreakersLocais(perfil, weather);

    try {
        const pedido =
            'Gere entre 6 e 12 temas curtos (3–8 palavras) que sirvam como sugestões de início de conversa/ações práticas sobre eficiência energética residencial. ' +
            'Adapte ao perfil do usuário e ao clima informado. Retorne apenas uma lista simples, cada item em uma linha, sem explicações.';

        const ragContext = 'Use o acervo (RAG) para priorizar recomendações práticas baseadas em normas e boas práticas.';
        const systemPatch = combinarContextos({ ragContext, userProfile: perfil, weatherData: weather, pergunta: pedido });

        const eficienciaId = await getOrCreateAssistantEficiencia();
        const thread = await openai.beta.threads.create();
        await addMessageToThread(thread.id, 'user', pedido);
        const resposta = await runAssistantOnThread(thread.id, eficienciaId, systemPatch);

        const texto = (toText(resposta) || '').trim();
        if (!texto) throw new Error('Resposta vazia do assistente');

        const rawItems = texto
            .split(/\r?\n|;|•|–|—|·/)
            .map(s => s.replace(/^\s*[\d\-\.\)\:]+\s*/, '').trim())
            .filter(s => s.length > 0);

        const uniq = Array.from(new Set(rawItems)).slice(0, 10);
        if (uniq.length === 0) return gerarIcebreakersLocais(perfil, weather);
        return uniq;
    } catch (err) {
        console.error('gerarIcebreakersRAGorLocal falhou, fallback local:', err);
        return gerarIcebreakersLocais(perfil, weather);
    }
}

async function gerarDicaDoDiaLLM({ perfil, weather }) {
    if (weather && weather.temperature != null) {
        if (weather.temperature >= 28) return '💡 Dica: ajuste ar-condicionado para 24–26°C e limpe filtros regularmente para eficiência.';
        if (weather.temperature <= 10) return '💡 Dica: aproveite o aquecimento solar e mantenha portas/janelas vedadas para reduzir perdas.';
    }
    if ((perfil || '').toLowerCase() === 'proativo') return '💡 Dica: experimente desligar elétricos durante 1 hora e compare o consumo.';
    return '💡 Dica rápida: desligue aparelhos em stand-by quando não estiverem em uso para reduzir consumo oculto.';
}

function getTodayDateString() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

async function gerarEGravarDailyContent(perfil, weather) {
    const temas = await gerarIcebreakersRAGorLocal(perfil, weather);
    const dica = await gerarDicaDoDiaLLM({ perfil, weather });
    const finalTemas = Array.isArray(temas) ? temas.slice(0, 10) : gerarIcebreakersLocais(perfil, weather);
    const today = getTodayDateString();

    const doc = await DailyData.findOneAndUpdate(
        { date: today },
        { date: today, dicaDia: toText(dica).slice(0, 1000), temas: finalTemas },
        { upsert: true, new: true }
    );

    return doc;
}

async function gerarNotificacaoToast({ perfil, weather }) {
    // Se falhar a IA, usa fallback
    const fallbacks = [
        "Economize energia: desligue luzes ao sair!",
        "Um banho mais curto poupa água e energia.",
        "Aproveite a luz natural hoje.",
        "Verifique se aparelhos estão em stand-by."
    ];

    try {
        const pedido = 'Gere uma frase curtíssima (max 10 palavras) e impactante para notificação push/toast de celular sobre economia de energia. Tom motivador e prático.';

        // Pode reutilizar thread ou criar efêmera. Aqui criando efêmera.
        const eficienciaId = await getOrCreateAssistantEficiencia();
        const thread = await openai.beta.threads.create();

        const systemPatch = combinarContextos({ userProfile: perfil, weatherData: weather, pergunta: pedido });
        await addMessageToThread(thread.id, 'user', pedido);
        const resposta = await runAssistantOnThread(thread.id, eficienciaId, systemPatch);

        let texto = toText(resposta).trim();
        // Remove aspas se vierem
        texto = texto.replace(/^["']|["']$/g, '');

        if (!texto) return fallbacks[0];
        return texto;
    } catch (err) {
        console.error('Erro ao gerar toast:', err);
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
}

module.exports = { gerarEGravarDailyContent, gerarIcebreakersLocais, getTodayDateString, gerarNotificacaoToast };
