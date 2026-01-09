const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ErrorLog = require('../models/ErrorLog');
const PasswordResetRequest = require('../models/PasswordResetRequest');
const bcrypt = require('bcryptjs');
const { requireLogin, requireAdmin } = require('../middleware/auth');

// Middleware de proteção para todas as rotas /admin
router.use(requireLogin);
router.use(requireAdmin);

// Dashboard Principal
router.get('/', async (req, res) => {
    try {
        // Busca todos os usuários, ordenados por última interação
        const users = await User.find({}, 'name email role perfilUsuario dadosUso.ultimoCalculoPerfil dadosUso.ultimaInteracao')
            .sort({ 'dadosUso.ultimaInteracao': -1 });

        // Busca os últimos 50 erros
        const errors = await ErrorLog.find({})
            .sort({ timestamp: -1 })
            .limit(50);

        // Busca solicitações de reset
        const resetRequests = await PasswordResetRequest.find({})
            .populate('userId', 'name')
            .sort({ timestamp: 1 });

        const usersWithStats = users.map(u => {
            const last = u.dadosUso?.ultimaInteracao ? new Date(u.dadosUso.ultimaInteracao).toLocaleString('pt-BR') : 'Nunca';
            const prof = u.dadosUso?.ultimoCalculoPerfil ? new Date(u.dadosUso.ultimoCalculoPerfil).toLocaleDateString('pt-BR') : 'N/A';
            return { ...u.toObject(), lastInteractionFormatted: last, lastProfileUpdate: prof };
        });

        res.render('admin_dashboard', {
            users: usersWithStats,
            resetRequests: resetRequests.map(r => ({
                ...r.toObject(),
                userName: r.userId ? r.userId.name : 'Usuário Removido',
                timestampFormatted: new Date(r.timestamp).toLocaleString('pt-BR')
            })),
            errors: errors.map(e => ({
                ...e.toObject(),
                timestampFormatted: new Date(e.timestamp).toLocaleString('pt-BR')
            }))
        });

    } catch (err) {
        console.error('Erro no dashboard admin:', err);
        res.status(500).send('Erro ao carregar dashboard administrativo.');
    }
});

// Reset de Senha (Admin)
router.post('/reset-password', async (req, res) => {
    const { userId } = req.body;
    try {
        const defaultPassword = 'Mudar123!';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        await User.findByIdAndUpdate(userId, {
            password: hashedPassword,
            forcePasswordChange: true
        });

        // Remove solicitação se existir
        await PasswordResetRequest.deleteMany({ userId });

        res.json({ ok: true, message: `Senha resetada para '${defaultPassword}'` });
    } catch (err) {
        console.error('Erro ao resetar senha:', err);
        res.status(500).json({ ok: false, error: 'Erro ao resetar senha.' });
    }
});

// CRON JOBS API

// Import CronManager singleton
const cronManager = require('../services/cronManager');

// Listar Cronjobs
router.get('/crons', (req, res) => {
    try {
        const jobs = cronManager.getAllJobs();
        res.json({ ok: true, jobs });
    } catch (err) {
        console.error('Erro ao listar cronjobs:', err);
        res.status(500).json({ ok: false, error: 'Erro ao listar cronjobs.' });
    }
});

// Rodar Job Imediatamente
router.post('/crons/:name/run', async (req, res) => {
    const { name } = req.params;
    try {
        await cronManager.runJob(name);
        res.json({ ok: true, message: `Job ${name} executado com sucesso.` });
    } catch (err) {
        console.error(`Erro ao rodar cronjob ${name}:`, err);
        res.status(500).json({ ok: false, error: err.message || 'Erro ao rodar job.' });
    }
});

// Atualizar Schedule
router.post('/crons/:name/schedule', (req, res) => {
    const { name } = req.params;
    const { schedule } = req.body;
    try {
        cronManager.updateSchedule(name, schedule);
        res.json({ ok: true, message: `Job ${name} reagendado para ${schedule}.` });
    } catch (err) {
        console.error(`Erro ao atualizar schedule do job ${name}:`, err);
        res.status(400).json({ ok: false, error: err.message || 'Erro ao atualizar schedule.' });
    }
});

// =============================================================================
// ANÁLISE DE PERFIL MANUAL
// =============================================================================

const { calculaPerfilUsuarioComAnalisePerfilAssistant } = require('../services/profileAnalysis');

// Trigger Manual de Análise de Perfil (Inicial ou Final)
router.post('/analyze-profile', async (req, res) => {
    const { userId, type, respostas } = req.body; // type: 'inicial' | 'final'

    if (!userId || !type) {
        return res.status(400).json({ ok: false, error: 'UserId e Type são obrigatórios.' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ ok: false, error: 'Usuário não encontrado.' });

        console.log(`[ADMIN] Iniciando análise ${type} para usuário ${user.email}...`);

        // Se vieram respostas no body, salva antes
        if (respostas) {
            if (type === 'inicial') user.respostasFormularioInicial = respostas;
            else if (type === 'final') user.respostasFormularioFinal = respostas;
            await user.save();
        }

        // Prepara dados para o serviço
        const dadosInput = {
            dadosUso: user.dadosUso,
            respostasFormulario: type === 'inicial' ? user.respostasFormularioInicial : user.respostasFormularioFinal
        };

        if (!dadosInput.respostasFormulario) {
            return res.status(400).json({ ok: false, error: `Não há respostas de formulário ${type} salvas para este usuário.` });
        }

        const novoPerfil = await calculaPerfilUsuarioComAnalisePerfilAssistant(dadosInput);

        // Atualiza campos específicos
        if (type === 'inicial') user.perfilInicial = novoPerfil;
        else if (type === 'final') user.perfilFinal = novoPerfil;

        // Atualiza o perfil "vigente"
        user.perfilUsuario = novoPerfil;
        user.dadosUso.ultimoCalculoPerfil = new Date();
        user.perfilAtualizadoEm = new Date();

        await user.save();

        console.log(`[ADMIN] Análise ${type} concluída. Perfil: ${novoPerfil}`);
        res.json({ ok: true, perfil: novoPerfil, type });

    } catch (err) {
        console.error('Erro ao analisar perfil manualmente:', err);
        res.status(500).json({ ok: false, error: err.message || 'Erro ao analisar perfil.' });
    }
});

module.exports = router;
