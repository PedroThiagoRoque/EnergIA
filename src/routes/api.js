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

const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Register endpoint
router.post('/register', async (req, res) => {
    const { name, email, password, ageRange, gender, vinculo } = req.body;

    if (!name || !email || !password || !ageRange || !gender || !vinculo) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios: name, email, password, ageRange, gender, vinculo' });
    }

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email já cadastrado.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Logic to balance groups 50/50
        const countWatts = await User.countDocuments({ group: 'Watts' });
        const countVolts = await User.countDocuments({ group: 'Volts' });

        let assignedGroup;
        if (countWatts < countVolts) {
            assignedGroup = 'Watts';
        } else if (countVolts < countWatts) {
            assignedGroup = 'Volts';
        } else {
            assignedGroup = Math.random() < 0.5 ? 'Watts' : 'Volts';
        }

        const newUser = await User.create({
            name,
            email,
            password: hashedPassword,
            group: assignedGroup,
            ageRange,
            gender,
            vinculo,
            respostasFormularioInicial: { _placeholder: true },
            respostasFormularioFinal: { _placeholder: true }
        });

        // Auto-login after register
        req.session.userId = newUser._id;
        req.session.userName = newUser.name;
        req.session.role = newUser.role;

        res.status(201).json({
            message: 'Usuário registrado com sucesso',
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                group: newUser.group,
                role: newUser.role
            }
        });

    } catch (err) {
        console.error('API /register error:', err);
        res.status(500).json({ error: 'Erro ao registrar usuário' });
    }
});

// Login endpoint
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    try {
        const user = await User.findOne({ email });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.userId = user._id;
            req.session.userName = user.name;
            req.session.role = user.role;

            return res.json({
                message: 'Login realizado com sucesso',
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    group: user.group,
                    role: user.role
                }
            });
        } else {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }
    } catch (err) {
        console.error('API /login error:', err);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
});

// Logout endpoint
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao fazer logout' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Logout realizado com sucesso' });
    });
});

