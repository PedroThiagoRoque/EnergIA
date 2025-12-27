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

async function calculaPerfilUsuarioComAnalisePerfilAssistant(dadosUso) {
    const name = 'AnalisePerfil';
    let assistantId = assistantCache[name];

    if (!assistantId) {
        const existing = await openai.beta.assistants.list();
        const found = existing.data.find(a => a.name === name);
        if (found) {
            assistantId = found.id;
        } else {
            const created = await openai.beta.assistants.create({
                name,
                model: process.env.LLM_MODEL_ANALISE || 'gpt-4o-mini',
                instructions: prompts.assistants.analisePerfil.instructions
            });
            assistantId = created.id;
        }
        assistantCache[name] = assistantId;
    }

    const thread = await openai.beta.threads.create();
    const dadosTexto =
        `ANÁLISE DE PERFIL COMPORTAMENTAL\n\n` +
        `Dados do usuário:\n` +
        `- Total de Interações: ${dadosUso.totalInteracoes}\n` +
        `- Período Preferencial: ${dadosUso.periodoPreferencial}\n` +
        `- Temas de Interesse: ${(dadosUso.temasInteresse || []).join(', ')}\n` +
        `- Frequência de Uso: ${dadosUso.frequenciaUso}\n` +
        `- Duração Média por Sessão: ${dadosUso.duracaoMediaSessao || 0} minutos\n` +
        `- Perguntas Técnicas: ${dadosUso.perguntasTecnicas || 0}\n` +
        `- Perguntas Básicas: ${dadosUso.perguntasBasicas || 0}\n` +
        `- Engajamento com Desafios: ${dadosUso.engajamentoDesafios || 0}\n` +
        `- Última Interação: ${dadosUso.ultimaInteracao}\n\n` +
        `Classifique o perfil.`;

    await openai.beta.threads.messages.create(thread.id, { role: 'user', content: toText(dadosTexto) });

    const run = await openai.beta.threads.runs.create(thread.id, { assistant_id: assistantId });

    // Poll até completar (timeout simples)
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
    const valid = ['Descuidado', 'Intermediário', 'Proativo'];
    return valid.includes(txt) ? txt : 'Intermediário';
}

module.exports = { calculaPerfilUsuarioComAnalisePerfilAssistant };
