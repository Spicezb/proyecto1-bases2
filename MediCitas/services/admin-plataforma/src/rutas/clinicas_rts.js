const express = require('express');
const router = express.Router();
const clinicasService = require('../servicios/clinicas_servicio');
const { autorizarRoles } = require('../middlewares/roles');

// GET /api/clinicas - Listar clínicas (Solo Administrador de plataforma)
router.get('/', autorizarRoles(['administrador de plataforma']), async (req, res) => {
    try {
    const resultado = await clinicasService.obtenerClinicas(req.user.userId);        
    res.status(200).json(resultado.clinicas);
    } catch (error) {
        console.error('Error al listar clínicas:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});

// POST /api/clinicas - RF1: Dar de alta clínica y su primer administrador
router.post('/', autorizarRoles(['administrador de plataforma']), async (req, res) => {
    try {
        const platformUserId = req.user.userId;

        const resultado = await clinicasService.crearClinica(req.body, platformUserId);

        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }

        res.status(201).json(resultado.clinica);
    } catch (error) {
        console.error('Error al crear clínica:', error);

        if (error.message && error.message.includes('Solo el administrador de plataforma')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.code === '23505') {
            return res.status(409).json({
                status: 'error',
                message: 'El nombre de la clínica o la identificación del usuario ya se encuentra registrado.'
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});

module.exports = router;
