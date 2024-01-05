//ROUTES
const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  router.get('/openai', (req, res) => {
    res.render('chat', { response: '' });
});

router.post('/openai/ask', async (req, res) => {
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
        return response;
    } catch (error) {
        console.error('Erro ao comunicar com a OpenAI API:', error);
        return { choices: [{ message: { content: 'Desculpe, não foi possível obter uma resposta. :C' } }] };
    }
}

module.exports = router;