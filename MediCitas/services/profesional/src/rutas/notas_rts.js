const express = require('express');
const router = express.Router();
const notasService = require('../servicios/notas_servicio');
const { autorizarRoles } = require('../middlewares/roles');

// POST /api/notas - RF15: Redactar nota clínica para una cita atendida
router.post('/', autorizarRoles(['profesional de salud']), async (req, res) => {
    try {
        const { citaId, contenido } = req.body;
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;

        const resultado = await notasService.crearNota(citaId, contenido, clinicId, auditPersonId);
        if (resultado.error) {
            return res.status(resultado.status).json({ status: 'error', message: resultado.error });
        }
        res.status(201).json(resultado.nota);
    } catch (error) {
        console.error('Error al registrar nota clínica:', error);
        if (error.message && error.message.includes('Solo el profesional asignado')) {
            return res.status(403).json({ status: 'error', message: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Error interno del servidor.' });
    }
});

// GET /api/notas/:citaId - RF15: Consultar nota clínica de una cita atendida
router.get('/:citaId', autorizarRoles(['profesional de salud']), async (req, res) => {
    try {
        const { citaId } = req.params;
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;

        const resultado = await notasService.consultarNota(citaId, clinicId, auditPersonId);
        if (resultado.error) {
            return res.status(resultado.status).json({ status: 'error', message: resultado.error });
        }
        if (!resultado.nota) {
            return res.status(404).json({ status: 'error', message: 'Nota clínica no encontrada para esta cita.' });
        }
        res.status(200).json(resultado.nota);
    } catch (error) {
        console.error('Error al consultar nota clínica:', error);
        if (error.message && error.message.includes('Solo el profesional asignado')) {
            return res.status(403).json({ status: 'error', message: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Error interno del servidor.' });
    }
});

module.exports = router;
