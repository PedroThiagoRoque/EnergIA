const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const VECTOR_STORE_ID = process.env.VECTOR_STORE_ID;
const assistantCache = {};

function toText(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function combinarContextos({ ragContext, userProfile, weatherData, pergunta }) {
    const ctx = [];
    if (ragContext) ctx.push(`CONHECIMENTO ESPECIALIZADO (RAG):\n${ragContext}`);
    if (userProfile) ctx.push(`PERFIL ATUAL: ${userProfile}`);
    if (weatherData && (weatherData.temperature != null || weatherData.weather?.description)) {
        const w = `${weatherData.temperature ?? '?'}°C, ${weatherData.humidity ?? '?'}% umidade, ${weatherData.weather?.description ?? ''}`;
        ctx.push(`CLIMA AGORA (${weatherData.city || 'local'}): ${w}`);
    }
    if (pergunta) ctx.push(`PERGUNTA DO USUÁRIO: ${pergunta}`);
    ctx.push(`LOCALIZAÇÃO PADRÃO: ZB2 Pelotas/RS - Subtropical úmido`);
    return ctx.join('\n\n');
}

const prompts = require('../config/prompts');

function buildBaseInstructionsEficiencia() {
    return prompts.assistants.eficiencia.instructions;
}

async function getOrCreateAssistantEficiencia() {
    const name = 'Eficiência';
    if (assistantCache[name]) return assistantCache[name];

    const existing = await openai.beta.assistants.list();
    const found = existing.data.find(a => a.name === name);
    if (found) {
        assistantCache[name] = found.id;
        return found.id;
    }

    const created = await openai.beta.assistants.create({
        name,
        model: process.env.LLM_MODEL_EFICIENCIA || 'gpt-4o-mini',
        instructions: buildBaseInstructionsEficiencia(),
        tools: [{ type: 'file_search' }],
        tool_resources: VECTOR_STORE_ID ? { file_search: { vector_store_ids: [VECTOR_STORE_ID] } } : undefined,
    });

    assistantCache[name] = created.id;
    return created.id;
}

async function addMessageToThread(threadId, role, content) {
    return openai.beta.threads.messages.create(threadId, { role, content: toText(content) });
}

async function runAssistantOnThread(threadId, assistantId, systemPatch) {
    const run = await openai.beta.threads.runs.create(threadId, {
        assistant_id: assistantId,
        instructions: toText(systemPatch), // INJEÇÃO DO CONTEXTO DINÂMICO por run
    });

    // Poll até completar (timeout simples)
    let status, attempts = 0;
    do {
        await new Promise(r => setTimeout(r, 1000));
        const r2 = await openai.beta.threads.runs.retrieve(threadId, run.id);
        status = r2.status;
        attempts++;
    } while (status !== 'completed' && status !== 'failed' && attempts < 60);

    if (status !== 'completed') throw new Error(`Run falhou: ${status}`);

    const list = await openai.beta.threads.messages.list(threadId);
    const msg = list.data.find(m => m.role === 'assistant') || list.data[0];
    const txt = msg?.content?.find?.(c => c.type === 'text')?.text?.value || '';
    return txt;
}

async function addMessageAndRunAssistant(threadId, userMessage, assistantId, systemPatch) {
    const msgText = toText(userMessage); // <-- garante string
    await addMessageToThread(threadId, 'user', msgText);
    return runAssistantOnThread(threadId, assistantId, systemPatch);
}

// =============================
// STREAMING
// =============================
function runAssistantOnThreadStream(threadId, assistantId, systemPatch) {
    return openai.beta.threads.runs.stream(threadId, {
        assistant_id: assistantId,
        instructions: toText(systemPatch),
    });
}

async function addMessageAndRunAssistantStream(threadId, userMessage, assistantId, systemPatch) {
    const msgText = toText(userMessage);
    await addMessageToThread(threadId, 'user', msgText);
    return runAssistantOnThreadStream(threadId, assistantId, systemPatch);
}

module.exports = {
    openai,
    toText,
    combinarContextos,
    getOrCreateAssistantEficiencia,
    addMessageToThread,
    runAssistantOnThread,
    addMessageToThread,
    runAssistantOnThread,
    addMessageAndRunAssistant,
    runAssistantOnThreadStream,
    addMessageAndRunAssistantStream
};
