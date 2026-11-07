const express = require('express');
const router = express.Router();
const horariosService = require('../servicios/horarios_servicio');
const { autorizarRoles } = require('../middlewares/roles');

// GET /api/horarios - Consultar horarios semanales (opcionalmente ?profesionalId=X)
router.get('/', autorizarRoles(['administrador de clínica', 'recepción', 'profesional de salud']), async (req, res) => {
    try {
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;
        const { profesionalId } = req.query;

        const resultado = await horariosService.obtenerHorarios(
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

        res.status(200).json(resultado.horarios);
    } catch (error) {
        console.error('Error al consultar horarios:', error);

        if (error.message.includes('Acceso denegado')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        return res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});

// GET /api/horarios/:id - Consultar un horario por su ID
router.get('/:id', autorizarRoles(['administrador de clínica', 'recepción', 'profesional de salud']), async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;

        const resultado = await horariosService.obtenerHorarioPorId(
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

        if (!resultado.horario) {
            return res.status(404).json({
                status: 'error',
                message: 'Horario no encontrado.'
            });
        }

        res.status(200).json(resultado.horario);
    } catch (error) {
        console.error('Error al consultar horario:', error);

        if (error.message.includes('Acceso denegado')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        return res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});

// POST /api/horarios - Registrar un nuevo horario semanal (Solo Administrador de clínica)
router.post('/', autorizarRoles(['administrador de clínica']), async (req, res) => {
    try {
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;

        const resultado = await horariosService.crearHorario(
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

        res.status(201).json(resultado.horario);
    } catch (error) {
        console.error('Error al registrar horario:', error);

        if (
            error.code === '23P01' ||
            (error.message && error.message.includes('excludeprofessionalschedules'))
        ) {
            return res.status(409).json({
                status: 'error',
                message: 'Ya existe un horario que se solapa con el intervalo indicado para este profesional en el mismo día.'
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

        if (
            error.message &&
            (error.message.includes('El día debe estar') ||
             error.message.includes('La hora de finalización'))
        ) {
            return res.status(400).json({
                status: 'error',
                message: error.message
            });
        }

        return res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});

// PUT /api/horarios/:id - Actualizar un horario semanal existente (Solo Administrador de clínica)
router.put('/:id', autorizarRoles(['administrador de clínica']), async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;

        const resultado = await horariosService.actualizarHorario(
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

        res.status(200).json(resultado.horario);
    } catch (error) {
        console.error('Error al actualizar horario:', error);

        if (
            error.code === '23P01' ||
            (error.message && error.message.includes('excludeprofessionalschedules'))
        ) {
            return res.status(409).json({
                status: 'error',
                message: 'El nuevo horario se solapa con otro horario activo del mismo profesional.'
            });
        }

        if (error.message && error.message.includes('Solo el administrador')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('Horario no encontrado')) {
            return res.status(404).json({
                status: 'error',
                message: error.message
            });
        }

        if (
            error.message &&
            (error.message.includes('El día debe estar') ||
             error.message.includes('La hora de finalización'))
        ) {
            return res.status(400).json({
                status: 'error',
                message: error.message
            });
        }

        return res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});

// DELETE /api/horarios/:id - Desactivar un horario semanal (Solo Administrador de clínica)
router.delete('/:id', autorizarRoles(['administrador de clínica']), async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;

        const resultado = await horariosService.eliminarHorario(
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
            message: 'Horario desactivado correctamente.',
            data: resultado.resultado
        });
    } catch (error) {
        console.error('Error al desactivar horario:', error);

        if (error.message && error.message.includes('Solo el administrador')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('Horario no encontrado')) {
            return res.status(404).json({
                status: 'error',
                message: error.message
            });
        }

        return res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});

module.exports = router;
