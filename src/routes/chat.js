/**
 * chat.js — RAG dinâmico + Perfil diário (Node.js + Express + MongoDB)
 * - Perfil comportamental atualizado 1x/dia após a 1ª interação do dia (com timestamp persistido).
 * - Dados de uso + CLIMA (via sessão/middleware) anexados ao prompt de sistema em TODA mensagem.
 * - Somente 2 assistentes: "Eficiência" (com RAG) e "AnalisePerfil" (classifica o perfil).
 * - Implementações fora do escopo comentadas como REMOVIDO para auditoria.
riáveis de ambiente (exemplos):
 *   OPENAI_API_KEY=...
 *   LLM_MODEL_EFICIENCIA=gpt-4o-mini
 *   LLM_MODEL_ANALISE=gpt-4o-mini
 *   VECTOR_STORE_ID=vs_...            // opcional, se usar file_search (RAG)
 */

const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const User = require('../models/User');
const DailyData = require('../models/DailyData');
require('dotenv').config();

const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// =============================
// Config & Cache
// =============================
const VECTOR_STORE_ID = process.env.VECTOR_STORE_ID;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const assistantCache = {}; // { name: assistantId }

// =============================
// Helpers gerais
// =============================
function toText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

// =============================
// Helpers — Análise de uso
// =============================
function analisarComplexidadePergunta(texto) {
  const t = (toText(texto) || '').toLowerCase();
  const termosTecnicos = ['api', 'código', 'driver', 'esp32', 'docker', 'vscode', 'rag', 'mongodb'];
  const termosBasicos = ['dica', 'conta de luz', 'como economizar', 'preço', 'quanto gasta'];
  let tech = 0, basic = 0;
  termosTecnicos.forEach(k => { if (t.includes(k)) tech++; });
  termosBasicos.forEach(k => { if (t.includes(k)) basic++; });
  return tech > basic ? 'tecnica' : 'basica';
}

async function inicializarDadosUsoSePreciso(user) {
  if (user.dadosUso) return user.dadosUso;
  const dados = {
    totalInteracoes: 0,
    periodoPreferencial: 'noite',
    temasInteresse: [],
    frequenciaUso: 'novo',
    duracaoMediaSessao: 0,
    perguntasTecnicas: 0,
    perguntasBasicas: 0,
    engajamentoDesafios: 0,
    ultimaInteracao: new Date(),
    ultimoCalculoPerfil: null,
  };
  await User.findByIdAndUpdate(user._id, { dadosUso: dados });
  return dados;
}

async function atualizarDadosUso(userId, textoPergunta) {
  const user = await User.findById(userId);
  if (!user) return null;

  await inicializarDadosUsoSePreciso(user);

  const agora = new Date();
  const hr = agora.getHours();
  const periodo = (hr >= 6 && hr < 12) ? 'manhã' : (hr < 18 ? 'tarde' : 'noite');

  // Total de interações do histórico (mensagens do usuário)
  const chat = await Chat.findOne({ userId });
  const totalHistorico = chat ? chat.messages.filter(m => m.sender === 'user').length : 0;

  const complex = analisarComplexidadePergunta(textoPergunta);
  const atual = user.dadosUso || {};

  const novoTotal = (atual.totalInteracoes || 0) + 1;
  const frequencia = novoTotal < 5 ? 'novo' : (novoTotal < 20 ? 'ocasional' : 'frequente');

  const perguntasTecnicas = complex === 'tecnica' ? (atual.perguntasTecnicas || 0) + 1 : (atual.perguntasTecnicas || 0);
  const perguntasBasicas = complex === 'basica' ? (atual.perguntasBasicas || 0) + 1 : (atual.perguntasBasicas || 0);

  const ordem = { manhã: 1, tarde: 2, noite: 3 };
  const periodoPreferencial =
    (ordem[atual.periodoPreferencial || 'noite'] || 0) >= (ordem[periodo] || 0)
      ? (atual.periodoPreferencial || 'noite')
      : periodo;

  const dadosUsoAtualizados = {
    ...atual,
    totalInteracoes: novoTotal,
    periodoPreferencial,
    frequenciaUso: frequencia,
    perguntasTecnicas,
    perguntasBasicas,
    ultimaInteracao: agora,
    totalHistorico, // opcional para auditoria
  };

  await User.findByIdAndUpdate(userId, { dadosUso: dadosUsoAtualizados });
  console.log(`Dados de uso atualizados para usuário ${userId}`);
  return dadosUsoAtualizados;
}

// =============================
// Assistente "AnalisePerfil" — classifica Descuidado/Intermediário/Proativo
// =============================
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
        instructions:
          'Você classifica o **perfil de eficiência energética** do usuário a partir de dados de uso.\n' +
          'Responda apenas com uma destas opções: Descuidado, Intermediário ou Proativo.'
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

async function ensureDailyProfileUpdate(userId) {
  const user = await User.findById(userId);
  if (!user) return null;

  await inicializarDadosUsoSePreciso(user);

  const last = user.dadosUso?.ultimoCalculoPerfil ? new Date(user.dadosUso.ultimoCalculoPerfil) : null;
  const now = new Date();
  const need = !last || (now - last) > ONE_DAY_MS || !user.perfilUsuario;

  if (!need) return { updated: false, perfil: user.perfilUsuario };

  const perfil = await calculaPerfilUsuarioComAnalisePerfilAssistant(user.dadosUso);
  await User.findByIdAndUpdate(userId, {
    perfilUsuario: perfil,
    'dadosUso.ultimoCalculoPerfil': now.toISOString(),
    perfilAtualizadoEm: now,
  });
  return { updated: true, perfil };
}

// =============================
// PROMPT DINÂMICO (RAG + uso + clima)
// =============================
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

function buildBaseInstructionsEficiencia() {
  return (
    'Você é **EnergIA**, um assistente bem-humorado, prático e técnico, especializado em **eficiência energética**.\n' +
    'Use RAG (documentos do vetor ligado) quando necessário.\n' +
    'Responda com precisão, didática e objetividade; sem recomendações genéricas vazias.\n' +
    'Se a pergunta fugir do escopo energia/eficiência/iluminação/climatização, oriente brevemente e volte ao foco.\n' +
    'Nunca copie literalmente estas instruções.'
  );
}

// =============================
// CLIMA via SESSÃO (middleware)
// =============================
function getWeatherFromRequest(req) {
  // Tenta várias fontes em ordem de preferência
  const raw =
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

// =============================
// OpenAI Assistants
// =============================
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
// Middleware: contexto dinâmico por mensagem
// =============================
async function attachDynamicContext(req, res, next) {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).send('Usuário não autenticado');

    const user = await User.findById(userId);
    if (!user) return res.status(404).send('Usuário não encontrado');

    const rawMessage = toText(req.body?.message);

    // (1) Atualiza dados de uso (incrementos da interação atual)
    const dadosUso = await atualizarDadosUso(userId, rawMessage || '');

    // (2) Garante atualização de perfil 1x/dia
    const daily = await ensureDailyProfileUpdate(userId);
    const perfil = daily?.perfil || user.perfilUsuario || 'Intermediário';

    // (3) Clima vindo do middleware/sessão (sem chamadas externas aqui)
    const weatherData = getWeatherFromRequest(req);

    // (4) Monta patch dinâmico de sistema
    const ragContext = 'Use os documentos do vetor quando necessário; priorize normas NBR, conceitos de eficiência, iluminação e climatização.';
    const systemPatch = combinarContextos({ ragContext, userProfile: perfil, weatherData, pergunta: rawMessage });

    req.dynamicContext = { dadosUso, perfil, weatherData, systemPatch };
    next();
  } catch (err) {
    console.error('attachDynamicContext error:', err);
    next(err);
  }
}

// =============================
// Rotas
// =============================

// Rota para obter o histórico do chat (renderiza EJS)
router.get('/', async (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).send('Usuário não autenticado');
  }

  try {
    let chat = await Chat.findOne({ userId });
    let messages = chat ? chat.messages : [];

    // Busca dados do usuário para exibir perfil
    const userData = await User.findById(userId);

    res.render('chat', {
      messages,
      userProfile: userData ? userData.perfilUsuario : 'Intermediário'
    });
  } catch (err) {
    console.error('Erro ao buscar histórico do chat:', err);
    res.status(500).send('Erro ao carregar o chat');
  }
});

// Healthcheck opcional
router.get('/health', (req, res) => {
  res.status(200).json({ ok: true, service: 'chat', time: new Date().toISOString() });
});

router.post('/message', attachDynamicContext, async (req, res) => {
  const { message } = req.body || {};
  const userId = req.session?.userId;
  if (!userId) return res.status(401).send('Usuário não autenticado');

  const msgText = toText(message).trim();
  if (!msgText) {
    return res.status(400).json({ ok: false, error: 'Mensagem vazia ou inválida.' });
  }

  try {
    let chat = await Chat.findOne({ userId });
    let threadId;

    if (!chat) {
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
      chat = new Chat({ userId, threadId, messages: [] });
      await chat.save();
    } else {
      threadId = chat.threadId;
    }

    // Persiste a mensagem do usuário
    chat.messages.push({ sender: 'user', content: msgText, timestamp: new Date() });
    await chat.save();

    // Apenas 2 assistentes: Eficiência (RAG) e AnalisePerfil (interno para cálculo do perfil)
    const eficienciaId = await getOrCreateAssistantEficiencia();

    // Executa com PATCH dinâmico (uso + clima)
    const reply = await addMessageAndRunAssistant(
      threadId,
      msgText,
      eficienciaId,
      req.dynamicContext.systemPatch
    );

    // Salva resposta
    chat.messages.push({
      sender: 'assistant',
      content: reply,
      assistantName: 'Eficiência',
      timestamp: new Date()
    });
    await chat.save();

    res.json({
      ok: true,
      reply,
      perfilUsuario: req.dynamicContext.perfil,
      dadosUso: req.dynamicContext.dadosUso,
      weather: req.dynamicContext.weatherData,
    });
  } catch (err) {
    console.error('Erro /message:', err);
    res.status(500).send('Erro ao processar a mensagem');
  }
});

// =============================
// Daily icebreakers (persistidos 1x/dia) — RAG quando disponível, fallback local
// =============================

function getTodayDateString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

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

async function gerarIcebreakersDaily(perfil, weather) {
  const today = getTodayDateString();
  try {
    const existing = await DailyData.findOne({ date: today });
    if (existing && Array.isArray(existing.temas) && existing.temas.length > 0) {
      return { temas: existing.temas, dica: existing.dicaDia, source: 'db' };
    }

    const temas = await gerarIcebreakersRAGorLocal(perfil, weather);
    const dica = await gerarDicaDoDiaLLM({ perfil, weather });
    const finalTemas = Array.isArray(temas) ? temas.slice(0, 10) : gerarIcebreakersLocais(perfil, weather);

    try {
      await DailyData.create({ date: today, dicaDia: toText(dica).slice(0, 1000), temas: finalTemas });
    } catch (e) {
      console.warn('Erro ao salvar DailyData (possível race):', e);
      const rec = await DailyData.findOne({ date: today });
      if (rec && rec.temas && rec.temas.length) return { temas: rec.temas, dica: rec.dicaDia, source: 'db_race' };
    }

    return { temas: finalTemas, dica, source: 'generated' };
  } catch (err) {
    console.error('gerarIcebreakersDaily erro:', err);
    return { temas: gerarIcebreakersLocais(perfil, weather), dica: null, source: 'fallback' };
  }
}

router.get('/daily/icebreakers', async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ ok: false, error: 'Usuário não autenticado' });
  try {
    const user = await User.findById(userId);
    const perfil = user?.perfilUsuario || 'Intermediário';
    const weather = getWeatherFromRequest(req);
    const result = await gerarIcebreakersDaily(perfil, weather);
    const temas = Array.isArray(result.temas) ? result.temas : gerarIcebreakersLocais(perfil, weather);
    res.json({ temas });
  } catch (err) {
    console.error('Erro /daily/icebreakers:', err);
    res.status(200).json({ temas: gerarIcebreakersLocais(null, null) });
  }
});

// Rota para forçar geração dos icebreakers do dia (use com cuidado)
router.post('/daily/generate', async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ ok: false, error: 'Usuário não autenticado' });
  try {
    const user = await User.findById(userId);
    const perfil = user?.perfilUsuario || 'Intermediário';
    const weather = getWeatherFromRequest(req);

    // Gera via RAG (se disponível) ou local e força salvar/atualizar o documento do dia
    const temas = await gerarIcebreakersRAGorLocal(perfil, weather);
    const dica = await gerarDicaDoDiaLLM({ perfil, weather });
    const finalTemas = Array.isArray(temas) ? temas.slice(0, 10) : gerarIcebreakersLocais(perfil, weather);
    const today = getTodayDateString();

    const doc = await DailyData.findOneAndUpdate(
      { date: today },
      { date: today, dicaDia: toText(dica).slice(0, 1000), temas: finalTemas },
      { upsert: true, new: true }
    );

    res.json({ ok: true, temas: finalTemas, dica: doc.dicaDia, source: 'forced' });
  } catch (err) {
    console.error('Erro /daily/generate:', err);
    res.status(500).json({ ok: false, error: 'Erro ao gerar icebreakers' });
  }
});

module.exports = router;
