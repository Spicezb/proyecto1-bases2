const express = require('express');
const router = express.Router();
const serviciosService = require('../servicios/servicios_servicio');

// GET /api/servicios - Consultar servicios médicos de la clínica
router.get('/', async (req, res) => {
    try {
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 2; // Temporal para pruebas locales (Administrador de clínica)

        const resultado = await serviciosService.obtenerServicios(clinicId, auditPersonId);

        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }

        res.status(200).json(resultado.servicios);
    } catch (error) {
        console.error('Error al consultar servicios:', error);

        if (error.message && error.message.includes('Acceso denegado')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor al consultar servicios médicos.'
        });
    }
});

// GET /api/servicios/:id - Consultar un servicio médico por ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 2; // Temporal para pruebas locales

        const resultado = await serviciosService.obtenerServicioPorId(
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

        if (!resultado.servicio) {
            return res.status(404).json({
                status: 'error',
                message: 'Servicio médico no encontrado.'
            });
        }

        res.status(200).json(resultado.servicio);
    } catch (error) {
        console.error('Error al consultar servicio:', error);

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

// POST /api/servicios - Registrar un nuevo servicio médico
router.post('/', async (req, res) => {
    try {
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 2; // Temporal para pruebas locales (Administrador de clínica)

        const resultado = await serviciosService.registrarServicio(
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

        res.status(201).json(resultado.servicio);
    } catch (error) {
        console.error('Error al registrar servicio:', error);

        if (error.message && error.message.includes('Solo el administrador')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('Ya existe un servicio con ese nombre')) {
            return res.status(409).json({
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

        if (error.message && error.message.includes('La duración del servicio')) {
            return res.status(400).json({
                status: 'error',
                message: error.message
            });
        }

        // Violación de clave única en clinicservices (duplicado en la misma clínica)
        if (error.code === '23505') {
            return res.status(409).json({
                status: 'error',
                message: 'El servicio ya se encuentra registrado en esta clínica.'
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});

// PUT /api/servicios/:id - Actualizar duración o estado de un servicio médico
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 2; // Temporal para pruebas locales (Administrador de clínica)

        const resultado = await serviciosService.actualizarServicio(
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

        res.status(200).json(resultado.servicio);
    } catch (error) {
        console.error('Error al actualizar servicio:', error);

        if (error.message && error.message.includes('Solo el administrador')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('no está asociado a esta clínica')) {
            return res.status(404).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('La duración del servicio')) {
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

// DELETE /api/servicios/:id - Dar de baja lógica un servicio médico
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = 1; // Temporal para pruebas locales
        const auditPersonId = 2; // Temporal para pruebas locales (Administrador de clínica)

        const resultado = await serviciosService.eliminarServicio(
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
            message: 'Servicio médico desactivado correctamente.',
            data: resultado.resultado
        });
    } catch (error) {
        console.error('Error al eliminar servicio:', error);

        if (error.message && error.message.includes('Solo el administrador')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('no está asociado a esta clínica')) {
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
