const express = require('express');
const router = express.Router();
const Chat = require('../models/chat');
require('dotenv').config();

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Função para criar um assistente, se necessário
async function createAssistantIfNeeded() {
  const existingAssistants = await openai.beta.assistants.list();
  const existingAssistant = existingAssistants.data.find(
    (assistant) => assistant.name === "EnergIA Assistant"
  );

  if (existingAssistant) {
    console.log("Assistente já existe:", existingAssistant);
    return existingAssistant;
  }

  const assistant = await openai.beta.assistants.create({
    name: "EnergIA Assistant",
    instructions: "Você é um assistente especializado em responder perguntas sobre eficiência energética.",
    model: "gpt-4o-mini",
  });

  console.log("Novo assistente criado:", assistant);
  return assistant;
}

// Função para criar um novo thread
async function createThread() {
  console.log('Criando uma nova thread...');
  const thread = await openai.beta.threads.create();
  console.log('Thread criada:', thread);
  return thread.id;
}

// Função para adicionar uma mensagem ao thread
async function addMessageToThread(threadId, role, content) {
  console.log(`Adicionando mensagem ao thread ${threadId}:`, content);
  try {
    const message = await openai.beta.threads.messages.create(threadId, {
      role: role,
      content: content,
    });
    return message;
  } catch (err) {
    console.error('Erro ao adicionar mensagem à thread:', err);
    throw err;
  }
}

// Função para executar o assistente e obter uma nova resposta a cada chamada
async function runAssistantOnThread(threadId, assistantId) {
  console.log('Executando assistente no thread:', threadId);
  try {
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });

    console.log('Run iniciado:', run.id);

    // Aguardar até que o "run" esteja concluído
    let runStatus;
    do {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const retrievedRun = await openai.beta.threads.runs.retrieve(threadId, run.id);
      runStatus = retrievedRun.status;
      console.log(`Status do run ${run.id}: ${runStatus}`);
    } while (runStatus !== 'completed' && runStatus !== 'failed');

    if (runStatus === 'completed') {
      return await getAssistantMessage(threadId, run.id);
    } else {
      throw new Error(`A execução do assistente falhou no estado: ${runStatus}.`);
    }
  } catch (error) {
    console.error("Erro ao iniciar um novo run na thread:", error);
    throw error;
  }
}

// Função para obter a resposta do assistente após o run específico
async function getAssistantMessage(threadId, runId) {
  console.log(`Obtendo mensagens da thread ${threadId} após o run ${runId}...`);
  try {
    const threadMessages = await openai.beta.threads.messages.list(threadId);

    if (!threadMessages || !threadMessages.data || !Array.isArray(threadMessages.data)) {
      throw new Error("Nenhuma mensagem foi encontrada na resposta do assistente.");
    }

    // Encontrar a mensagem do assistente correspondente ao run atual
    const assistantMessages = threadMessages.data.filter(
      msg => msg.role === 'assistant' && msg.run_id === runId
    );

    if (assistantMessages.length > 0) {
      const lastMessage = assistantMessages[assistantMessages.length - 1];
      console.log('Última mensagem do assistente:', lastMessage);

      // Tratamento adequado do formato do conteúdo retornado
      if (typeof lastMessage.content === 'string') {
        return lastMessage.content;
      } else if (Array.isArray(lastMessage.content)) {
        const textContent = lastMessage.content
          .filter(contentItem => contentItem.type === 'text')
          .map(contentItem => contentItem.text?.value || '')
          .join(' ');
        return textContent.trim();
      } else if (typeof lastMessage.content === 'object' && lastMessage.content.text) {
        return lastMessage.content.text.value || '';
      } else {
        throw new Error("Formato da mensagem do assistente não reconhecido.");
      }
    } else {
      throw new Error("Nenhuma resposta do assistente foi encontrada.");
    }
  } catch (err) {
    console.error('Erro ao obter resposta do assistente:', err);
    throw err;
  }
}

// Função para adicionar a mensagem ao thread e obter uma resposta do assistente
async function addMessageAndRunAssistant(threadId, message, assistantId) {
  try {
    await addMessageToThread(threadId, 'user', message);

    // Cria uma nova execução (run) do assistente no thread e obtém a resposta
    const assistantResponse = await runAssistantOnThread(threadId, assistantId);
    return assistantResponse;
  } catch (error) {
    console.error("Erro ao adicionar mensagem e executar o assistente:", error);
    throw error;
  }
}

// Rota para enviar uma mensagem
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
      threadId = await createThread();
      chat = new Chat({ userId, threadId, messages: [] });
      await chat.save();
    } else {
      threadId = chat.threadId;
    }

    // Adiciona a mensagem do usuário ao histórico do MongoDB
    chat.messages.push({ sender: "user", content: message });
    await chat.save();

    // Seleciona o assistente e obtém a resposta
    const assistant = await createAssistantIfNeeded();
    const assistantResponse = await addMessageAndRunAssistant(threadId, message, assistant.id);

    // Adiciona a resposta do assistente ao histórico do MongoDB
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

// Rota para obter o histórico do chat
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

module.exports = router;
