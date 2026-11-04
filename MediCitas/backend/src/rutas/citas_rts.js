const express = require('express');
const router = express.Router();
const citasService = require('../servicios/citas_servicio');

// POST /api/citas - RF9: Reservar una cita
router.post('/', async (req, res) => {
    try {
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 5; // Temporal para pruebas locales (Recepción: luis-mora)

        const resultado = await citasService.reservarCita(
            req.body,
            clinicId,
            auditPersonId
        );

        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }

        res.status(201).json(resultado.cita);
    } catch (error) {
        console.error('Error al reservar cita:', error);

        // Espacio no disponible o traslape con cita existente (concurrencia)
        if (
            error.code === '23P01' ||
            (error.message && (
                error.message.includes('no está disponible') ||
                error.message.includes('excludeappointments')
            ))
        ) {
            return res.status(409).json({
                status: 'error',
                message: error.message || 'El espacio solicitado no está disponible o ya fue reservado.'
            });
        }

        if (error.message && error.message.includes('Solo recepción')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        if (
            error.message && (
                error.message.includes('no pertenece a la clínica') ||
                error.message.includes('no disponible para el profesional') ||
                error.message.includes('no disponible en la clínica')
            )
        ) {
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

// PUT /api/citas/:id/reprogramar - RF10: Reprogramar una cita vigente
router.put('/:id/reprogramar', async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 7; // Temporal para pruebas locales (Recepción)

        const resultado = await citasService.reprogramarCita(
            id,
            req.body,
            clinicId,
            auditPersonId
        );

        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }

        res.status(200).json(resultado.cita);
    } catch (error) {
        console.error('Error al reprogramar cita:', error);
  
        if (
            error.code === '23P01' ||
            (error.message && (
                error.message.includes('no está disponible') ||
                error.message.includes('excludeappointments')
            ))
        ) {
            return res.status(409).json({
                status: 'error',
                message: 'El espacio solicitado no está disponible o ya fue reservado.'
            });
        }

        if (error.message && error.message.includes('Solo recepción')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('Cita vigente no encontrada')) {
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

// PUT /api/citas/:id/cancelar - RF11: Cancelar una cita
router.put('/:id/cancelar', async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body;
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 7; // Temporal para pruebas locales (Recepción)

        const resultado = await citasService.cancelarCita(
            id,
            motivo,
            clinicId,
            auditPersonId
        );

        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }

        res.status(200).json(resultado.cita);
    } catch (error) {
        console.error('Error al cancelar cita:', error);

        if (error.message && error.message.includes('Solo recepción')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('Transición de estado inválida')) {
            return res.status(400).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('Cita no encontrada')) {
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

// PUT /api/citas/:id/desenlace - RF12 & RF13: Registrar desenlace (atendida o ausente)
router.put('/:id/desenlace', async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body; // 'atendida' o 'ausente'
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 12; // Temporal para pruebas locales (Profesional de salud asignado: maria-rojas)

        const resultado = await citasService.registrarDesenlace(
            id,
            estado,
            clinicId,
            auditPersonId
        );

        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }

        res.status(200).json(resultado.cita);
    } catch (error) {
        console.error('Error al registrar desenlace de cita:', error);

        if (error.message && error.message.includes('Solo el profesional')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        if (
            error.message && (
                error.message.includes('solo se registra después') ||
                error.message.includes('Transición de estado inválida')
            )
        ) {
            return res.status(400).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('Cita no encontrada')) {
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

// GET /api/citas/agenda - RF20: Mostrar la agenda del día
router.get('/agenda', async (req, res) => {
    try {
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 7; // Temporal para pruebas locales (Recepción)
        const { fecha, profesionalId } = req.query;

        if (!fecha) {
            return res.status(400).json({
                status: 'error',
                message: 'Debe proporcionar el parámetro fecha (YYYY-MM-DD).'
            });
        }

        const resultado = await citasService.consultarAgenda(
            clinicId,
            auditPersonId,
            fecha,
            profesionalId
        );

        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }

        res.status(200).json(resultado.agenda);
    } catch (error) {
        console.error('Error al consultar agenda:', error);

        if (error.message && error.message.includes('Acceso denegado')) {
            return res.status(403).json({
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

// GET /api/citas/paciente/:pacienteId - RF16: Consultar historial de citas de un paciente
router.get('/paciente/:pacienteId', async (req, res) => {
    try {
        const { pacienteId } = req.params;
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 7; // Temporal para pruebas locales (Recepción)

        const resultado = await citasService.consultarCitasPaciente(
            clinicId,
            auditPersonId,
            pacienteId
        );

        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }

        res.status(200).json(resultado.citas);
    } catch (error) {
        console.error('Error al consultar historial del paciente:', error);

        if (error.message && error.message.includes('Acceso denegado')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('Paciente no pertenece a la clínica')) {
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

// GET /api/citas/conteo - RF21: Contar citas por estado en un rango de fechas
router.get('/conteo', async (req, res) => {
    try {
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 7; // Temporal para pruebas locales (Admin de clínica)
        const { fechaInicio, fechaFin } = req.query;

        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                status: 'error',
                message: 'Debe proporcionar fechaInicio y fechaFin (YYYY-MM-DD).'
            });
        }

        const resultado = await citasService.contarCitasPorEstado(
            clinicId,
            auditPersonId,
            fechaInicio,
            fechaFin
        );

        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }

        res.status(200).json(resultado.resumen);
    } catch (error) {
        console.error('Error al contar citas por estado:', error);

        if (error.message && error.message.includes('Acceso denegado')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('Rango de fechas inválido')) {
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
