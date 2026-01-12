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

        const notification = await gerarNotificacaoToast({
            perfil: user.perfilUsuario,
            weather: null, // Pode ser integrado se necessário
            group: user.group
        });

        res.json({ notification });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
