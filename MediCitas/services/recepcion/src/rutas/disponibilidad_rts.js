const express = require('express');
const router = express.Router();
const disponibilidadService = require('../servicios/disponibilidad_servicio');
const { autorizarRoles } = require('../middlewares/roles');

// GET /api/disponibilidad/profesional - RF7: Espacios disponibles de un profesional en una fecha
router.get('/profesional', autorizarRoles(['administrador de clínica', 'recepción', 'profesional de salud']), async (req, res) => {
    try {
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;
        const { profesionalId, fecha } = req.query;

        if (!profesionalId || !fecha) {
            return res.status(400).json({
                status: 'error',
                message: 'Debe proporcionar profesionalId y fecha (YYYY-MM-DD).'
            });
        }

        const resultado = await disponibilidadService.consultarDisponibilidadProfesional(
            clinicId,
            auditPersonId,
            profesionalId,
            fecha,
            req.user.roleName
        );

        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }

        res.status(200).json(resultado.espacios);
    } catch (error) {
        console.error('Error al consultar disponibilidad del profesional:', error);

        if (
            error.message &&
            (error.message.includes('Acceso denegado') ||
             error.message.includes('No tiene permiso'))
        ) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('El profesional no pertenece')) {
            return res.status(404).json({
                status: 'error',
                message: error.message
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});

// GET /api/disponibilidad/servicio - RF8: Disponibilidad por servicio en un rango de fechas
router.get('/servicio', autorizarRoles(['administrador de clínica', 'recepción', 'profesional de salud']), async (req, res) => {
    try {
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;
        const { servicioId, fechaInicio, fechaFin } = req.query;

        if (!servicioId || !fechaInicio || !fechaFin) {
            return res.status(400).json({
                status: 'error',
                message: 'Debe proporcionar servicioId, fechaInicio y fechaFin (YYYY-MM-DD).'
            });
        }

        const resultado = await disponibilidadService.consultarDisponibilidadServicio(
            clinicId,
            auditPersonId,
            servicioId,
            fechaInicio,
            fechaFin
        );

        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }

        res.status(200).json(resultado.disponibilidad);
    } catch (error) {
        console.error('Error al consultar disponibilidad por servicio:', error);

        if (error.message && error.message.includes('Acceso denegado')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('Servicio no disponible')) {
            return res.status(404).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('La fecha inicial no puede ser posterior')) {
            return res.status(400).json({
                status: 'error',
                message: error.message
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});

module.exports = router;
