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
const prompts = require('../config/prompts');

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
        const pedido = prompts.daily.icebreakers.user;

        const ragContext = prompts.daily.icebreakers.ragContext;
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
    const fallback = '💡 Dica rápida: desligue aparelhos em stand-by quando não estiverem em uso para reduzir consumo oculto.';
    console.log('[DicaDia] Iniciando geração de dica do dia via LLM...');

    try {
        const pedido = prompts.daily.tip.user;

        const ragContext = prompts.daily.tip.ragContext;
        const systemPatch = combinarContextos({ ragContext, userProfile: perfil, weatherData: weather, pergunta: pedido });
        console.log('[DicaDia] Contexto montado. Obtendo assistente...');

        const eficienciaId = await getOrCreateAssistantEficiencia();
        console.log(`[DicaDia] Assistant ID: ${eficienciaId}`);

        const thread = await openai.beta.threads.create();
        console.log(`[DicaDia] Thread criada: ${thread.id}`);

        await addMessageToThread(thread.id, 'user', pedido);
        console.log('[DicaDia] Mensagem adicionada. Rodando assistente...');

        const resposta = await runAssistantOnThread(thread.id, eficienciaId, systemPatch);
        console.log(`[DicaDia] Resposta crua do assistente: "${resposta}"`);

        let texto = toText(resposta).trim();
        texto = texto.replace(/^["']|["']$/g, ''); // Remove wrapping quotes

        if (!texto) {
            console.warn('[DicaDia] Resposta vazia após processamento. Usando fallback.');
            return fallback;
        }

        if (!texto.startsWith('💡')) texto = `💡 Dica: ${texto}`;

        console.log(`[DicaDia] Sucesso: ${texto}`);
        return texto;

    } catch (err) {
        console.error('Erro ao gerar Dica do Dia LLM:', err);
        if (err.response) {
            console.error('OpenAI Response Data:', err.response.data);
        }
        // Fallback inteligente baseado em clima/perfil se a IA falhar
        if (weather && weather.temperature != null) {
            if (weather.temperature >= 28) return '💡 Dica: ajuste ar-condicionado para 24–26°C e limpe filtros regularmente para eficiência.';
            if (weather.temperature <= 10) return '💡 Dica: aproveite o aquecimento solar e mantenha portas/janelas vedadas para reduzir perdas.';
        }
        if ((perfil || '').toLowerCase() === 'proativo') return '💡 Dica: experimente desligar elétricos durante 1 hora e compare o consumo.';
        return fallback;
    }
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

    // Gerar Toasts
    let dailyToasts = [];
    try {
        console.log('[DailyContent] Gerando toasts...');
        dailyToasts = await gerarToastsBatch(perfil, weather);
    } catch (err) {
        console.error('[DailyContent] Erro ao gerar toasts batch:', err);
    }

    const today = getTodayDateString();

    const updateData = { date: today, dicaDia: toText(dica).slice(0, 1000), temas: finalTemas, toasts: dailyToasts };
    console.log('[DailyContent] Tentando atualizar DB:', updateData);

    const doc = await DailyData.findOneAndUpdate(
        { date: today },
        updateData,
        { upsert: true, new: true }
    );

    console.log('[DailyContent] DB Atualizado. Doc ID:', doc?._id);
    console.log('[DailyContent] Dica salva:', doc?.dicaDia);
    console.log(`[DailyContent] Toasts salvos: ${doc?.toasts?.length}`);

    return doc;
}

async function gerarToastsBatch(perfil, weather) {
    try {
        const pedido = prompts.daily.toast.user;
        const ragContext = 'Use criatividade e dados técnicos para frases motivadoras.';
        const systemPatch = combinarContextos({ ragContext, userProfile: perfil, weatherData: weather, pergunta: pedido });

        const eficienciaId = await getOrCreateAssistantEficiencia();
        const thread = await openai.beta.threads.create();

        await addMessageToThread(thread.id, 'user', pedido);
        const resposta = await runAssistantOnThread(thread.id, eficienciaId, systemPatch);

        const text = toText(resposta).replace(/```json|```/g, '').trim();
        const json = JSON.parse(text);

        if (json.toasts && Array.isArray(json.toasts)) {
            return json.toasts.slice(0, 5);
        }
        return [];
    } catch (err) {
        console.error('Erro no batch de toasts:', err);
        return [];
    }
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
        const today = getTodayDateString();
        const doc = await DailyData.findOne({ date: today });

        if (doc && doc.toasts && doc.toasts.length > 0) {
            const random = doc.toasts[Math.floor(Math.random() * doc.toasts.length)];
            return random;
        }

        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    } catch (err) {
        console.error('Erro ao recuperar toast:', err);
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
}

module.exports = { gerarEGravarDailyContent, gerarIcebreakersLocais, getTodayDateString, gerarNotificacaoToast };
