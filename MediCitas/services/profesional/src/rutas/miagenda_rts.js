const express = require('express');
const router = express.Router();
const miagendaService = require('../servicios/miagenda_servicio');
const { autorizarRoles } = require('../middlewares/roles');

// GET /api/mi-agenda - RF20: Consultar propia agenda del día
router.get('/', autorizarRoles(['profesional de salud']), async (req, res) => {
    try {
        const { fecha } = req.query;
        if (!fecha) {
            return res.status(400).json({ status: 'error', message: 'Debe proporcionar el parámetro fecha (YYYY-MM-DD).' });
        }

        const resultado = await miagendaService.consultarAgendaPropia(req.user.clinicId, req.user.userId, fecha);
        if (resultado.error) {
            return res.status(resultado.status).json({ status: 'error', message: resultado.error });
        }
        res.status(200).json(resultado.agenda);
    } catch (error) {
        console.error('Error al consultar agenda:', error);
        if (error.message && error.message.includes('Acceso denegado')) {
            return res.status(403).json({ status: 'error', message: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Error interno del servidor.' });
    }
});

// GET /api/mi-agenda/horarios - RF5: Consultar propios horarios semanales
router.get('/horarios', autorizarRoles(['profesional de salud']), async (req, res) => {
    try {
        const resultado = await miagendaService.consultarHorariosPropios(req.user.clinicId, req.user.userId);
        res.status(200).json(resultado.horarios);
    } catch (error) {
        console.error('Error al consultar horarios:', error);
        if (error.message && error.message.includes('Acceso denegado')) {
            return res.status(403).json({ status: 'error', message: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Error interno del servidor.' });
    }
});

// PUT /api/mi-agenda/citas/:id/desenlace - RF12: Registrar desenlace de una cita propia
router.put('/citas/:id/desenlace', autorizarRoles(['profesional de salud']), async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        const resultado = await miagendaService.registrarDesenlace(id, estado, req.user.clinicId, req.user.userId);
        if (resultado.error) {
            return res.status(resultado.status).json({ status: 'error', message: resultado.error });
        }
        res.status(200).json(resultado.cita);
    } catch (error) {
        console.error('Error al registrar desenlace:', error);
        if (
            error.message &&
            (error.message.includes('Solo el profesional asignado') ||
             error.message.includes('Acceso denegado'))
        ) {
            return res.status(403).json({ status: 'error', message: error.message });
        }
        if (error.message && error.message.includes('Cita no encontrada')) {
            return res.status(404).json({ status: 'error', message: error.message });
        }
        if (error.message && (error.message.includes('solo se registra después') || error.message.includes('Transición de estado'))) {
            return res.status(400).json({ status: 'error', message: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Error interno del servidor.' });
    }
});

// GET /api/mi-agenda/pacientes/:id/historial - RF16: Consultar historial de citas de un paciente
router.get('/pacientes/:id/historial', autorizarRoles(['profesional de salud']), async (req, res) => {
    try {
        const { id } = req.params;
        const resultado = await miagendaService.consultarHistorialPaciente(id, req.user.clinicId, req.user.userId);
        if (resultado.error) {
            return res.status(resultado.status).json({ status: 'error', message: resultado.error });
        }
        res.status(200).json(resultado.historial);
    } catch (error) {
        console.error('Error al consultar historial del paciente:', error);
        if (
            error.message &&
            (error.message.includes('No tiene permiso') ||
             error.message.includes('Acceso denegado'))
        ) {
            return res.status(403).json({ status: 'error', message: error.message });
        }
        if (error.message && error.message.includes('Paciente no pertenece a la clínica')) {
            return res.status(404).json({ status: 'error', message: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Error interno del servidor.' });
    }
});

module.exports = router;
