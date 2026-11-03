const express = require('express');
const router = express.Router();
const bloqueosService = require('../servicios/bloqueos_servicio');

// GET /api/bloqueos - Consultar bloqueos de agenda (opcional ?profesionalId=X)
router.get('/', async (req, res) => {
    try {
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 2; // Temporal para pruebas locales (Administrador de clínica)
        const { profesionalId } = req.query;

        const resultado = await bloqueosService.obtenerBloqueos(
            clinicId,
            auditPersonId,
            profesionalId
        );

        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }

        res.status(200).json(resultado.bloqueos);
    } catch (error) {
        console.error('Error al consultar bloqueos:', error);

        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor al consultar bloqueos.'
        });
    }
});

// GET /api/bloqueos/:id - Consultar un bloqueo por ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 2; // Temporal para pruebas locales

        const resultado = await bloqueosService.obtenerBloqueoPorId(
            id,
            clinicId,
            auditPersonId
        );

        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }

        if (!resultado.bloqueo) {
            return res.status(404).json({
                status: 'error',
                message: 'Bloqueo de agenda no encontrado.'
            });
        }

        res.status(200).json(resultado.bloqueo);
    } catch (error) {
        console.error('Error al consultar bloqueo:', error);

        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});

// POST /api/bloqueos - Registrar un bloqueo de agenda
router.post('/', async (req, res) => {
    try {
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 2; // Temporal para pruebas locales (Administrador de clínica)

        const resultado = await bloqueosService.crearBloqueo(
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

        res.status(201).json(resultado.bloqueo);
    } catch (error) {
        console.error('Error al crear bloqueo:', error);

        // Violación de restricción de exclusión (traslape de bloqueos para el mismo profesional)
        if (
            error.code === '23P01' ||
            (error.message && error.message.includes('excludescheduleblocks'))
        ) {
            return res.status(409).json({
                status: 'error',
                message: 'Ya existe un bloqueo que se traslapa con el rango horario indicado para este profesional.'
            });
        }

        if (error.message && error.message.includes('Solo el administrador')) {
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

        if (error.message && error.message.includes('La fecha de finalización')) {
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

// PUT /api/bloqueos/:id - Modificar un bloqueo existente
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 2; // Temporal para pruebas locales (Administrador de clínica)

        const resultado = await bloqueosService.actualizarBloqueo(
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

        res.status(200).json(resultado.bloqueo);
    } catch (error) {
        console.error('Error al actualizar bloqueo:', error);

        if (
            error.code === '23P01' ||
            (error.message && error.message.includes('excludescheduleblocks'))
        ) {
            return res.status(409).json({
                status: 'error',
                message: 'El nuevo rango del bloqueo se traslapa con otro bloqueo activo del mismo profesional.'
            });
        }

        if (error.message && error.message.includes('Solo el administrador')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('Bloqueo no encontrado')) {
            return res.status(404).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('La fecha de finalización')) {
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

// DELETE /api/bloqueos/:id - Desactivar un bloqueo (baja lógica)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 2; // Temporal para pruebas locales (Administrador de clínica)

        const resultado = await bloqueosService.eliminarBloqueo(
            id,
            clinicId,
            auditPersonId
        );

        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }

        res.status(200).json({
            status: 'ok',
            message: 'Bloqueo de agenda desactivado correctamente.',
            data: resultado.resultado
        });
    } catch (error) {
        console.error('Error al desactivar bloqueo:', error);

        if (error.message && error.message.includes('Solo el administrador')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('Bloqueo no encontrado')) {
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

module.exports = router;
