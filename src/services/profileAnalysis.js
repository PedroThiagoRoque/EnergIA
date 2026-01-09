const OpenAI = require('openai');
require('dotenv').config();

const prompts = require('../config/prompts');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const assistantCache = {};

function toText(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

// =============================================================================
// SCORING HELPERS
// =============================================================================

function calculateAttitudeScore(answers) {
    // 1.1. Em que medida concorda ou discorda...
    // Mapeamento: Discordo totalmente (1), Discordo (2), Nem (3), Concordo (4), Concordo totalmente (5)
    // Perguntas positivas: 1, 3, 4, 5, 6, 7, 8, 9, 10
    // Perguntas negativas ou neutras? (Para este scopo, assumimos todas positivas pro-ambiente ou invertemos se necessário).
    // Analisando o form:
    // 14: "A forma como utilizo a energia não influencia..." (NEGATIVA -> Inverter)
    // 23: "Há benefícios... derivados das alterações climáticas" (NEGATIVA -> Inverter - embora seja discutivel, geralmente em contexto ambiental é visto como alienação)

    // Simplificação: Vamos assumir que 'answers' tem chaves como 'q1_1', 'q1_2', etc. e valores de 1 a 5.
    // O chamador deve garantir que o input esteja normalizado ou tratamos strings aqui.
    // Se o input for string "Concordo", precisaria de um parser. Vamos assumir que o frontend envia valores numéricos ou o parser é feito antes.
    // Assunção para este código: O objeto answers contém { "1.1": 5, "1.2": 2, ... } ou similar.
    // Como o formato exato das respostas JSON não foi especificado, faremos uma heurística robusta para chaves ou assumiremos um flat map.

    // Implementação Genérica de Soma com ajustes
    let score = 0;
    let maxScore = 0;

    // Definição das questões baseada no markdown visualizado
    // 1.3: Faria mais... (+)
    // 1.4: A forma como utilizo... não influencia (-) -> Inverter
    // 1.5: Posso influenciar governo (+)
    // 1.6: Posso influenciar empresas (+)
    // 1.7: Confio que o governo faça... (+)
    // 1.8: Cientistas vão resolver... (Tecno-otimismo, pode ser visto como passividade, mas vamos pontuar como confiança)
    // 1.9: Parques eólicos (+)
    // 1.10: Normas rígidas carros (+)
    // 1.11: Alterações climáticas grave (+)
    // 1.12: Mudanças causadas por humanos (+)
    // 1.13: Benefícios das alterações (-) -> Inverter

    const mapLikert = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 3; // Neutro se nulo
        const v = val.toLowerCase();
        if (v.includes('totalmente') && v.includes('discordo')) return 1;
        if (v.includes('discordo')) return 2;
        if (v.includes('nem')) return 3;
        if (v.includes('totalmente') && v.includes('concordo')) return 5;
        if (v.includes('concordo')) return 4;
        return 3;
    };

    const items = [
        { key: '1.3', reverse: false }, // Faria mais
        { key: '1.4', reverse: true },  // Não influencia
        { key: '1.5', reverse: false },
        { key: '1.6', reverse: false },
        { key: '1.7', reverse: false },
        { key: '1.8', reverse: false },
        { key: '1.9', reverse: false },
        { key: '1.10', reverse: false },
        { key: '1.11', reverse: false },
        { key: '1.12', reverse: false },
        { key: '1.13', reverse: true }, // Benefícios
    ];

    items.forEach(item => {
        let val = mapLikert(answers[item.key] || answers[item.key.replace('.', '')]); // Tenta "1.3" ou "13"
        if (item.reverse) val = 6 - val; // Inverte 1->5, 5->1
        score += val;
        maxScore += 5;
    });

    return { score, maxScore, percentage: (score / maxScore) * 100 };
}

function calculateActionFrequencyScore(answers) {
    // 3.3. Frequência de ações
    // Nunca (1), Raramente (2), Frequentemente (3), Sempre (4)
    // Todas parecem ações positivas de pro-atividade.

    const mapFreq = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 1;
        const v = val.toLowerCase();
        if (v.includes('nunca')) return 1;
        if (v.includes('raramente')) return 2;
        if (v.includes('frequentemente')) return 3;
        if (v.includes('sempre')) return 4;
        return 1;
    };

    const keys = [
        '3.3.1', // Luzes
        '3.3.2', // Ar condicionado
        '3.3.3', // Agua
        '3.3.4', // Transporte
        '3.3.5', // Produtos menos energia
        '3.3.6', // Produtos amigáveis
        '3.3.7', // Celular noite
        '3.3.8', // Stand by
        '3.3.9', // Portões manuais
        '3.3.10' // Pilhas recarregáveis
    ];

    let score = 0;
    let maxScore = keys.length * 4;

    keys.forEach(k => {
        score += mapFreq(answers[k] || answers[k.replace(/\./g, '')]);
    });

    return { score, maxScore, percentage: (score / maxScore) * 100 };
}

function calculateCampusAwarenessScore(answers) {
    // Parte 2: A energia na sua instituição
    // 5.1 (Sim=1/Não=0)
    // 6.2 (Sim=1/Não=0/Não sei=0)
    // 7.3 (Sim=1/Não=0)
    // 9.4 (Sim=1/Não=0)

    const isYes = (val) => val && String(val).toLowerCase().trim() === 'sim';

    let score = 0;
    if (isYes(answers['5.1'] || answers['51'])) score++;
    if (isYes(answers['6.2'] || answers['62'])) score++;
    if (isYes(answers['7.3'] || answers['73'])) score++;
    if (isYes(answers['9.4'] || answers['94'])) score++;

    return { score, maxScore: 4, percentage: (score / 4) * 100 };
}

function calculateKnowledgeScore(answers) {
    // Parte 3: Conhecimento ambiental geral
    // Verdadeiro ou Falso

    // Gabarito (baseado no senso comum científico atual):
    // 11.1 Fumaça cidades -> Fabricas? (Depende da cidade, mas geralmente Veículos. A questão pode ser "pegadinha". Original: "A maior parte... vem das fábricas". Em SP é veículos. Mas globalmente? Vamos assumir que para o 'senso comum' antigo era fabrica, mas modernamente veiculos. Se o gabarito oficial não foi dado, vou assumir FALSO para veículos serem os maiores vilões, ou VERDADEIRO se for uma visão mais industrial. VOU ASSUMIR: FALSO (Veículos são principais em áreas urbanas densas).) *Ajuste*: Sem gabarito oficial, é arriscado. Mas vamos tentar padronizar.*
    // Vamos pular validação rígida de certo/errado e usar o LLM para julgar? Não, o pedido foi "função que dá nota".
    // Vou assumir um gabarito padrão razoável:

    // 11.1: Fumaça -> Fábricas. (Geralmente Falso, veiculos). GABARITO: F
    // 12.2: Mercúrio peixes -> Inaceitáveis. (Verdadeiro em muitos casos). GABARITO: V
    // 13.3: Diesel polui menos que gasolina. (Falso, emite mais MP e NOx). GABARITO: F
    // 14.4: Homem parte integrante natureza. (Verdadeiro). GABARITO: V
    // 15.5: Alumínio mais tempo que ferro. (Verdadeiro, não oxida igual). GABARITO: V
    // 16.6: Sacos plásticos não decompõem aterros. (Verdadeiro, condições anaeróbicas). GABARITO: V
    // 17.7: Stand by não gasta energia. (Falso). GABARITO: F
    // 18.8: Água agricultura. (Verdadeiro, ~70%). GABARITO: V

    const gabarito = {
        '11.1': 'falso',
        '12.2': 'verdadeiro',
        '13.3': 'falso',
        '14.4': 'verdadeiro',
        '15.5': 'verdadeiro',
        '16.6': 'verdadeiro',
        '17.7': 'falso',
        '18.8': 'verdadeiro'
    };

    let score = 0;

    Object.keys(gabarito).forEach(k => {
        const userVal = String(answers[k] || answers[k.replace('.', '')] || '').toLowerCase().trim();
        // Normaliza userVal (pode ser " verdadeiro ", "( ) verdadeiro", etc)
        const isV = userVal.includes('verdadeiro') || userVal === 'v';
        const isF = userVal.includes('falso') || userVal === 'f';

        const correctIsV = gabarito[k] === 'verdadeiro';

        if (correctIsV && isV) score++;
        else if (!correctIsV && isF) score++;
    });

    return { score, maxScore: 8, percentage: (score / 8) * 100 };
}


// =============================================================================
// MAIN ANALYZER
// =============================================================================

/**
 * Calculates user profile using LLM based on usage data OR Form data.
 * @param {Object} inputData - Contains context about the user.
 * @param {Object} inputData.dadosUso - Usage metrics (optional).
 * @param {Object} inputData.respostasFormulario - Form answers (optional).
 */
async function calculaPerfilUsuarioComAnalisePerfilAssistant(inputData) {
    const name = 'AnalisePerfil';
    let assistantId = assistantCache[name];

    // Setup Assistant
    if (!assistantId) {
        const existing = await openai.beta.assistants.list();
        const found = existing.data.find(a => a.name === name);
        if (found) {
            assistantId = found.id;
        } else {
            const created = await openai.beta.assistants.create({
                name,
                model: process.env.LLM_MODEL_ANALISE || 'gpt-4o-mini',
                instructions: prompts.assistants.analisePerfil.instructions // Ensure this exists or fallback
            });
            assistantId = created.id;
        }
        assistantCache[name] = assistantId;
    }

    // Construct Prompt Data
    let dadosTexto = `ANÁLISE DE PERFIL COMPORTAMENTAL DE SUSTENTABILIDADE\n\n`;

    // 1. Dados de Uso (se houver)
    if (inputData.dadosUso) {
        dadosTexto += `DADOS DE INTERAÇÃO COM O CHATBOT:\n` +
            `- Total de Interações: ${inputData.dadosUso.totalInteracoes}\n` +
            `- Temas: ${(inputData.dadosUso.temasInteresse || []).join(', ')}\n` +
            `- Frequência: ${inputData.dadosUso.frequenciaUso}\n` +
            `- Engajamento: ${inputData.dadosUso.engajamentoDesafios || 0}\n\n`;
    }

    // 2. Dados do Formulário (se houver)
    if (inputData.respostasFormulario) {
        const answers = inputData.respostasFormulario;
        const s1 = calculateAttitudeScore(answers);
        const s2 = calculateActionFrequencyScore(answers);
        const s3 = calculateCampusAwarenessScore(answers);
        const s4 = calculateKnowledgeScore(answers);

        dadosTexto += `RESULTADOS DO QUESTIONÁRIO DE PRÁTICAS AMBIENTAIS:\n` +
            `1. Atitudes e Crenças: ${s1.score}/${s1.maxScore} (${s1.percentage.toFixed(0)}%)\n` +
            `2. Comportamento/Frequência de Ações: ${s2.score}/${s2.maxScore} (${s2.percentage.toFixed(0)}%)\n` +
            `3. Consciência na Instituição: ${s3.score}/${s3.maxScore} (${s3.percentage.toFixed(0)}%)\n` +
            `4. Conhecimento Técnico Geral: ${s4.score}/${s4.maxScore} (${s4.percentage.toFixed(0)}%)\n\n` +
            `RESPOSTAS ABERTAS RELEVANTES:\n` +
            `- Barreira para poupar: ${answers['4.4'] || answers['44'] || 'Não respondeu'}\n` +
            `- Iniciativas conhecidas: ${answers['8'] || 'N/A'}\n` +
            `- Maior desperdício notado: ${answers['10.5'] || answers['105'] || 'N/A'}\n\n`;
    }

    dadosTexto += `Com base nestes dados, classifique o usuário em um dos 3 perfis: 'Descuidado', 'Intermediário', ou 'Proativo'.\n` +
        `Responda APENAS com o nome do perfil.`;

    // Call LLM
    const thread = await openai.beta.threads.create();
    await openai.beta.threads.messages.create(thread.id, { role: 'user', content: toText(dadosTexto) });
    const run = await openai.beta.threads.runs.create(thread.id, { assistant_id: assistantId });

    // Poll logic
    let status, attempts = 0;
    do {
        await new Promise(r => setTimeout(r, 1000));
        const r2 = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        status = r2.status;
        attempts++;
    } while (status !== 'completed' && status !== 'failed' && attempts < 45);

    if (status !== 'completed') return 'Intermediário';

    const list = await openai.beta.threads.messages.list(thread.id);
    const msg = list.data.find(m => m.role === 'assistant') || list.data[0];
    const txt = msg?.content?.find?.(c => c.type === 'text')?.text?.value?.trim?.() || 'Intermediário';

    // Normalize response
    const cleaned = txt.replace(/['".]/g, ''); // Remove quotes/dots
    const valid = ['Descuidado', 'Intermediário', 'Proativo'];

    // Fuzzy match simple
    if (cleaned.toLowerCase().includes('descuidado')) return 'Descuidado';
    if (cleaned.toLowerCase().includes('proativo') || cleaned.toLowerCase().includes('pro ativo')) return 'Proativo';
    if (cleaned.toLowerCase().includes('intermediário') || cleaned.toLowerCase().includes('intermediario')) return 'Intermediário';

    return 'Intermediário'; // Fallback Default
}

module.exports = { calculaPerfilUsuarioComAnalisePerfilAssistant };
