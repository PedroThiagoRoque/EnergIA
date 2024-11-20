const express = require('express');
const router = express.Router();
const Chat = require('../models/chat');

//////////////////////////////////////////////////////
// Inicialização de APIs
const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

////////////////////////////////////////////////////////
async function createAssistants() {
  const mainAssistant = await openai.beta.assistants.create({
    name: "Assistente Principal",
    instructions: "Você é um assistente que responde perguntas gerais sobre eficiência energética e gerencia outros assistentes.",
    model: "gpt-4",
  });

  const documentAssistant = await openai.beta.assistants.create({
    name: "Assistente de Documentos",
    instructions: "Você é responsável por pesquisar em documentos fornecidos pelo usuário e responder perguntas baseadas nos documentos.",
    model: "gpt-4",
  });

  /*const consumptionAssistant = await openai.beta.assistants.create({
    name: "Assistente de Consumo",
    instructions: "Você fornece informações sobre consumo energético usando dados do banco de dados do usuário.",
    model: "gpt-4",
    tools: [{ type: "function" }],
  });*/

  return { mainAssistant, documentAssistant};
}


async function createThread() {
  try {
    const thread = await openai.beta.threads.create();
    if (!thread || !thread.id) {
      throw new Error("Falha ao criar uma nova thread.");
    }
    console.log("tó2", thread);
    return thread.id;
  } catch (err) {
    console.error('Erro ao criar a thread:', err);
    throw err;
  }
}



async function addMessageToThread(threadId, role, content) {
  const message = await openai.beta.threads.messages.create(threadId, {
    role: role,
    content: content,
  });
  return message;
}


async function routeMessage(userInput, assistants, threadId) {
  let assistant;

  if (userInput.includes('documento')) {
    assistant = assistants.documentAssistant;
  } else if (userInput.includes('consumo')) {
    //assistant = assistants.consumptionAssistant;
  } else {
    assistant = assistants.mainAssistant;
  }

  await addMessageToThread(threadId, "user", userInput);
  return runAssistantOnThread(assistant.id, threadId);
}



async function runAssistantOnThread(assistantId, threadId) {
  const run = await openai.beta.threads.runs.create(
    threadId,
    {assistant_id: assistantId}
  );
  return run;
}


//rotas
router.get('/', async (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).send('Usuário não autenticado');
  }

  try {
    let chat = await Chat.findOne({ userId });
    let messages = chat ? chat.messages : [];
    res.render('chat', { messages });
  } catch (err) {
    console.error('Erro ao buscar histórico do chat:', err);
    res.status(500).send('Erro ao carregar o chat');
  }
});

router.post('/message', async (req, res) => {
  const { message } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).send('Usuário não autenticado');
  }

  try {
    // Busca ou cria um chat para o usuário
    let chat = await Chat.findOne({ userId });
    let threadId;

    if (!chat) {
      // Cria uma nova thread se não existir
      threadId = await createThread();
      chat = new Chat({ userId, threadId, messages: [] });
      await chat.save();
    } else {
      threadId = chat.threadId;
    }
    console.log("tó3", threadId);
    // Adiciona a mensagem do usuário à thread
    await addMessageToThread(threadId, "user", message);

    // Seleciona um assistente adequado
    const assistants = await createAssistants();
    const run = await routeMessage(message, assistants, threadId);

    // Adiciona uma mensagem do usuário ao histórico
    chat.messages.push({ sender: "user", content: message });
    await chat.save();

    // Simula uma resposta do assistente (neste caso, uma resposta simples)
    const assistantResponse = "Resposta simulada do assistente.";

    // Adiciona a resposta do assistente ao histórico de mensagens no BD
    chat.messages.push({ sender: "assistant", content: assistantResponse });
    await chat.save();

    res.json({
      response: assistantResponse,
      assistantType: "Assistente Principal",
    });

  } catch (err) {
    console.error('Erro ao processar a mensagem:', err);
    res.status(500).send('Erro ao processar a mensagem');
  }
});


//////////////////////////////////////////////////////////

module.exports = router;
