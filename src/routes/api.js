const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.json({ message: "API is working" });
});

router.get('/notification', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    try {
        const User = require('../models/User');
        const { gerarNotificacaoToast } = require('../services/dailyContent');

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        let notification = '';
        try {
            notification = await gerarNotificacaoToast({
                perfil: user.perfilUsuario,
                weather: null, // Pode ser integrado se necessário
                group: user.group
            });
        } catch (innerError) {
            console.error('Error generating notification logic:', innerError);
            // Return fallback directly to avoid 500
            notification = "Olá! Como posso ajudar você hoje?";
        }

        res.json({ notification });
    } catch (err) {
        console.error('API /notification error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/notification/toasts', async (req, res) => {
    try {
        const { getDailyToasts } = require('../services/dailyContent');
        const toasts = await getDailyToasts();
        res.json({ toasts });
    } catch (err) {
        console.error('API /notification/toasts error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
