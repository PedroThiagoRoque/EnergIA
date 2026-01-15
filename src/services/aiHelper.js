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

function combinarContextos({ ragContext, userProfile, weatherData, pergunta, baseInstructions, dadosUso }) {
    const ctx = [];

    // 0. Base Instructions (Persona)
    if (baseInstructions) {
        ctx.push(`${baseInstructions}`);
    }

    // 1. Conhecimento Especializado (RAG)
    if (ragContext) {
        ctx.push(`CONHECIMENTO ESPECIALIZADO:\nUse a documentação especializada quando necessário para responder com precisão técnica sobre: ${ragContext}`);
    }

    // 2. Contexto Climático
    if (weatherData) {
        const temp = weatherData.temperature ?? '?';
        const hum = weatherData.humidity ?? '?';
        const desc = weatherData.weather?.description ?? 'N/A';
        const city = weatherData.city || 'Pelotas/RS';
        const hora = new Date().toLocaleTimeString('pt-BR');

        ctx.push(`CONTEXTO CLIMÁTICO ATUAL EM ${city.toUpperCase()}:\n- Temperatura: ${temp}°C\n- Condição: ${desc}\n- Umidade: ${hum}%\n- Hora da consulta: ${hora}`);

        // Recomendações dinâmicas simples baseadas no clima
        let recClima = '• Mantenha o conforto térmico de forma passiva';
        if (temp > 25) recClima = '• Aproveite a ventilação natural; evite ganho de calor solar direto';
        if (temp < 15) recClima = '• Maximize aquecimento solar passivo; evite correntes de ar frio';

        ctx.push(`RECOMENDAÇÕES ESPECÍFICAS PARA O CLIMA ATUAL:\n${recClima}`);
        ctx.push(`ZONA BIOCLIMÁTICA: ZB2 (${city} - Subtropical Úmido)\n- Estratégias recomendadas: Ventilação cruzada no verão, aquecimento solar passivo no inverno`);
    }

    // 3. Personalização Baseada no Usuário
    if (userProfile || dadosUso) {
        const perfil = userProfile || 'Intermediário';
        const uso = dadosUso || {};
        const interactions = uso.totalInteracoes || 0;
        const periodo = uso.periodoPreferencial || 'variável';

        ctx.push(`PERSONALIZAÇÃO BASEADA NO USUÁRIO:\n- PERFIL: ${perfil}\n- HISTÓRICO DE USO: ${uso.frequenciaUso || 'novo'}, interage principalmente no periodo da ${periodo}; ${interactions} interações registradas.\n- PILARES TCP ATIVOS: atitude, norma, controle`);

        // Guidelines de estrutura baseadas no perfil
        let estrutura = '';
        if (perfil === 'Proativo') {
            estrutura = '1. Cumprimente de forma adequada ao perfil Proativo\n2. Inclua benefício pessoal claro (econômico, conforto, ambiental)\n3. Adicione referência social motivadora\n4. Sugira ação simples e acessível para hoje\n5. Insira a dica com "💡"\n6. Mencione influência do clima\n7. Finalize com convite suave';
        } else if (perfil === 'Descuidado') {
            estrutura = '1. Use tom acolhedor e muito simples\n2. Foque apenas em economia financeira imediata\n3. Sugira uma única ação extremamente fácil\n4. Reforce que "todo começo importa"\n5. Evite qualquer tecnicismo';
        } else {
            estrutura = '1. Cumprimente com energia moderada\n2. Relacione conforto e economia\n3. Sugira ação prática de médio impacto\n4. Convite a experimentar novos hábitos';
        }
        ctx.push(`ESTRUTURA PERSONALIZADA DA RESPOSTA:\n${estrutura}`);
    }

    if (pergunta) {
        ctx.push(`INSTRUÇÃO FINAL:\nUse o conhecimento especializado acima para fundamentar sua resposta à pergunta abaixo, adaptando a linguagem ao perfil ${userProfile || 'do usuário'}.\n\nPERGUNTA DO USUÁRIO: ${pergunta}`);
    }

    return ctx.join('\n\n========================================\n\n');
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

function buildBaseInstructionsVolts() {
    return prompts.assistants.volts.instructions;
}

async function getOrCreateAssistantVolts() {
    const name = 'Volts';
    if (assistantCache[name]) return assistantCache[name];

    const existing = await openai.beta.assistants.list();
    const found = existing.data.find(a => a.name === name);
    if (found) {
        assistantCache[name] = found.id;
        return found.id;
    }

    const created = await openai.beta.assistants.create({
        name,
        model: process.env.LLM_MODEL_VOLTS || 'gpt-4o-mini',
        instructions: buildBaseInstructionsVolts(),
        // Sem RAG (file_search) para Volts
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
    addMessageAndRunAssistantStream,
    addMessageAndRunAssistantStream,
    getOrCreateAssistantVolts,
    getEficienciaInstructions: () => prompts.assistants.eficiencia.instructions
};
