const express = require('express');
const router = express.Router();
const profesionalesService = require('../servicios/profesionales_servicio');

// GET /api/profesionales - Consultar profesionales de la clínica
router.get('/', async (req, res) => {
    try {
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 2; // Temporal para pruebas locales (Administrador de clínica)

        const resultado = await profesionalesService.obtenerProfesionales(clinicId, auditPersonId);

        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }

        res.status(200).json(resultado.profesionales);
    } catch (error) {
        console.error('Error al consultar profesionales:', error);

        if (error.message && error.message.includes('Acceso denegado')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor al consultar profesionales.'
        });
    }
});

// GET /api/profesionales/:id - Consultar profesional por ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 2; // Temporal para pruebas locales

        const resultado = await profesionalesService.obtenerProfesionalPorId(
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

        if (!resultado.profesional) {
            return res.status(404).json({
                status: 'error',
                message: 'Profesional no encontrado en esta clínica.'
            });
        }

        res.status(200).json(resultado.profesional);
    } catch (error) {
        console.error('Error al consultar profesional:', error);

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

// GET /api/profesionales/:id/servicios - Consultar servicios de un profesional
router.get('/:id/servicios', async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = 1; // Temporal para pruebas locales

        const resultado = await profesionalesService.obtenerServiciosProfesional(id, clinicId);

        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }

        res.status(200).json(resultado.servicios);
    } catch (error) {
        console.error('Error al consultar servicios del profesional:', error);

        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});

// POST /api/profesionales - Registrar nuevo profesional
router.post('/', async (req, res) => {
    try {
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 2; // Temporal para pruebas locales (Administrador de clínica)

        const resultado = await profesionalesService.registrarProfesional(
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

        res.status(201).json(resultado.profesional);
    } catch (error) {
        console.error('Error al registrar profesional:', error);

        if (error.message && error.message.includes('Solo el administrador')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('El usuario debe ser un profesional de salud')) {
            return res.status(400).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('La especialidad no existe')) {
            return res.status(404).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.code === '23505') {
            return res.status(409).json({
                status: 'error',
                message: 'El profesional o su licencia ya se encuentra registrado.'
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});

// POST /api/profesionales/:id/servicios - Habilitar servicio a un profesional
router.post('/:id/servicios', async (req, res) => {
    try {
        const { id } = req.params;
        const { servicioId } = req.body;
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 2; // Temporal para pruebas locales (Administrador de clínica)

        const resultado = await profesionalesService.asociarServicio(
            id,
            servicioId,
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
            message: 'Servicio asignado correctamente al profesional.',
            data: resultado.resultado
        });
    } catch (error) {
        console.error('Error al asociar servicio al profesional:', error);

        if (error.message && error.message.includes('Solo el administrador')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        if (
            error.message &&
            (error.message.includes('El profesional no pertenece') ||
             error.message.includes('El servicio no está disponible'))
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

// PUT /api/profesionales/:id - Actualizar datos del profesional
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 2; // Temporal para pruebas locales (Administrador de clínica)

        const resultado = await profesionalesService.actualizarProfesional(
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

        res.status(200).json(resultado.profesional);
    } catch (error) {
        console.error('Error al actualizar profesional:', error);

        if (error.message && error.message.includes('Solo el administrador')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('no está asociado activamente')) {
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

// DELETE /api/profesionales/:id - Desactivar profesional (baja lógica)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 2; // Temporal para pruebas locales (Administrador de clínica)

        const resultado = await profesionalesService.eliminarProfesional(
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
            message: 'Profesional desactivado correctamente.',
            data: resultado.resultado
        });
    } catch (error) {
        console.error('Error al eliminar profesional:', error);

        if (error.message && error.message.includes('Solo el administrador')) {
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

module.exports = router;
