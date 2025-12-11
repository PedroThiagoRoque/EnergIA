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

const { getWeatherFromRequest } = require('../services/weatherService');
const {
  toText,
  combinarContextos,
  getOrCreateAssistantEficiencia,
  addMessageAndRunAssistant,
  addMessageAndRunAssistantStream // Novo helper
} = require('../services/aiHelper');
const { gerarIcebreakersLocais, getTodayDateString } = require('../services/dailyContent');

// =============================
// Config & Cache
// =============================

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
// REMOVIDO: Lógica movida para cron job (src/jobs/profileCron.js) e service (src/services/profileAnalysis.js)

// REMOVIDO: Lógica movida para cron job

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

    // (2) REMOVIDO ensureDailyProfileUpdate (Agora via Cron às 07:00)
    // Apenas lemos o perfil atual do banco
    const perfil = user.perfilUsuario || 'Intermediário';

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

  // Configura Headers para SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

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

    const eficienciaId = await getOrCreateAssistantEficiencia();

    // Inicia Stream
    const stream = await addMessageAndRunAssistantStream(
      threadId,
      msgText,
      eficienciaId,
      req.dynamicContext.systemPatch
    );

    let fullResponse = '';

    for await (const event of stream) {
      if (event.event === 'thread.message.delta') {
        const chunk = event.data.delta.content?.[0]?.text?.value;
        if (chunk) {
          fullResponse += chunk;
          // Envia chunk para o cliente
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        }
      }
    }

    // Salva resposta do assistente no banco
    chat.messages.push({
      sender: 'assistant',
      content: fullResponse,
      assistantName: 'Eficiência',
      timestamp: new Date()
    });
    await chat.save();

    // Envia evento final com metadados
    const metadata = {
      done: true,
      perfilUsuario: req.dynamicContext.perfil,
      dadosUso: req.dynamicContext.dadosUso,
      weather: req.dynamicContext.weatherData,
    };
    res.write(`data: ${JSON.stringify(metadata)}\n\n`);
    res.end();

  } catch (err) {
    console.error('Erro /message:', err);
    // Tenta enviar erro via SSE se a conexão ainda estiver aberta
    res.write(`data: ${JSON.stringify({ error: 'Erro ao processar mensagem' })}\n\n`);
    res.end();
  }
});

// =============================
// Daily icebreakers (leitura otimizada)
// =============================

router.get('/daily/icebreakers', async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ ok: false, error: 'Usuário não autenticado' });

  const today = getTodayDateString();
  try {
    // Tenta ler do banco (gerado pelo cron)
    const existing = await DailyData.findOne({ date: today });
    if (existing && Array.isArray(existing.temas) && existing.temas.length > 0) {
      return res.json({ temas: existing.temas });
    }

    // Fallback: Se não tem no banco (cron falhou?), retorna estático local e NÃO chama IA
    // para garantir resposta instantânea.
    const user = await User.findById(userId);
    const perfil = user?.perfilUsuario || 'Intermediário';
    const local = gerarIcebreakersLocais(perfil, null);

    return res.json({ temas: local, source: 'fallback_local' });

  } catch (err) {
    console.error('Erro /daily/icebreakers:', err);
    res.status(200).json({ temas: gerarIcebreakersLocais(null, null) });
  }
});

module.exports = router;
