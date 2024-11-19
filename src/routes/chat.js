const express = require('express');
const path = require('path');
const router = express.Router();

const bodyParser = require('body-parser');
require('dotenv').config();

//////////////////////////////////////////////////////
//Configurações de APIs
const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

////////////////////////////////////////////////////
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

const cliente = new BedrockRuntimeClient({ 
    region: "us-east-1",
        model: "claude-2",//apiVersion: '2023-09-30',
        credentials:{
            accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? ""
        } 
});
///////////////////////////////////////////////////////

//Tela de chat padrão
router.get('/', (req,res) => { 
   res.render('chat', {response: ''});
});

///////////////////////////////////////

//Rotas OPENAI

router.post('/openai', async (req, res) => {
    const userInput = req.body.userInput;

    const openAiResponse = await getOpenAiResponse(userInput);

    res.json({ response: openAiResponse.choices[0].message.content });
});

async function getOpenAiResponse(prompt) {
    try {
        const response = await openai.chat.completions.create({
            messages: [
                { role: "system", content: "Você é um ajudante de eficiência energética, sua missão é guiar os usuários até o entendimento da importância da eficiência energética. Explique os conceitos e demonstre ações práticas que possam contribuir. Seja paciente, descomplicado e cuidadoso nas explicações. Crie respostas breves sempre que possivel, mantenha o tema da conversa sobre eficiência energética. Para temas que não forem sobre eficiência energética responda que não sabe responder e direcione para algo sobre eficiência energética." }, //guia inicial da conversação com o modelo
                { role: "user", content: prompt } //prompt do usuário
            ],
            model: "gpt-3.5-turbo",
        });
        console.log("você: "+ prompt);
        return response;
    } catch (error) {
        console.error('Erro ao comunicar com a OpenAI API:', error);
        return { choices: [{ message: { content: 'Desculpe, não foi possível obter uma resposta. :C' } }] };
    }
}

///////////////////////////////////////////

// src/routes/chat.js
const Chat = require('../models/Chat');
const User = require('../models/User');

router.post('/message', async (req, res) => {
  const { message } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).send('Usuário não autenticado');
  }

  try {
    let chat = await Chat.findOne({ userId });

    if (!chat) {
      chat = await Chat.create({ userId, messages: [] });
    }

    // Adicionar a mensagem do usuário
    chat.messages.push({ sender: 'user', message });
    
    // Aqui você processaria a resposta do bot (por exemplo, usando alguma API ou lógica local)
    const botResponse = "Esta é a resposta do bot";  // Substitua pela lógica de resposta real

    // Adicionar a resposta do bot
    chat.messages.push({ sender: 'bot', message: botResponse });

    // Salvar o chat atualizado
    await chat.save();

    res.send({ response: botResponse });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao salvar o chat');
  }
});


module.exports = router;