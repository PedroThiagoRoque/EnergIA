/**
 * chatGen.js — Chat Genérico (Controle - Volts)
 * - Sem RAG.
 * - Assistente "Volts" (genérico, breve).
 * - Sem análise de perfil complexa (apenas mantemos a estrutura básica se necessário, ou removemos).
 */

const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const User = require('../models/User');
require('dotenv').config();

const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const {
    toText,
    getOrCreateAssistantVolts,
    addMessageAndRunAssistantStream
} = require('../services/aiHelper');

// =============================
// Rotas
// =============================

// Rota para obter o histórico do chat (renderiza EJS específico)
router.get('/', async (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
        return res.status(401).send('Usuário não autenticado');
    }

    // Verificação de segurança: Apenas Volts devem acessar
    try {
        const user = await User.findById(userId);
        if (!user || user.group !== 'Volts') {
            return res.redirect('/chat'); // Manda de volta pro chat normal se não for Volts
        }

        let chat = await Chat.findOne({ userId });
        let messages = chat ? chat.messages : [];

        res.render('chat_gen', {
            messages,
            userName: user.name
        });
    } catch (err) {
        console.error('Erro ao buscar histórico do chat genérico:', err);
        res.status(500).send('Erro ao carregar o chat');
    }
});

router.post('/message', async (req, res) => {
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

        // Obtém assistente Volts (sem RAG)
        const voltsId = await getOrCreateAssistantVolts();

        // Inicia Stream
        const stream = await addMessageAndRunAssistantStream(
            threadId,
            msgText,
            voltsId,
            '' // Sem systemPatch complexo, ou mensagem simples se quiser reforçar algo
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
            assistantName: 'Volts', // Identificador
            timestamp: new Date()
        });
        await chat.save();

        // Envia evento final
        const metadata = {
            done: true
        };
        res.write(`data: ${JSON.stringify(metadata)}\n\n`);
        res.end();

    } catch (err) {
        console.error('Erro /message (Volts):', err);
        res.write(`data: ${JSON.stringify({ error: 'Erro ao processar mensagem' })}\n\n`);
        res.end();
    }
});

module.exports = router;
