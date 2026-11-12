const express = require('express');
const router = express.Router();
const profesionalesService = require('../servicios/profesionales_servicio');
const { autorizarRoles } = require('../middlewares/roles');

// GET /api/profesionales - Consultar profesionales de la clínica
router.get('/', autorizarRoles(['administrador de clínica', 'recepción', 'profesional de salud']), async (req, res) => {
    try {
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;

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
            message: 'Error interno del servidor.'
        });
    }
});

// GET /api/profesionales/:id - Consultar profesional por ID
router.get('/:id', autorizarRoles(['administrador de clínica', 'recepción', 'profesional de salud']), async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;

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
router.get('/:id/servicios', autorizarRoles(['administrador de clínica', 'recepción', 'profesional de salud']), async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;

        const resultado = await profesionalesService.obtenerServiciosProfesional(id, clinicId, auditPersonId);

        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }

        res.status(200).json(resultado.servicios);
    } catch (error) {
        console.error('Error al consultar servicios del profesional:', error);

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

// POST /api/profesionales - Registrar nuevo profesional (Solo Administrador de clínica)
router.post('/', autorizarRoles(['administrador de clínica']), async (req, res) => {
    try {
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;

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

// POST /api/profesionales/:id/servicios - Habilitar servicio a un profesional (Solo Administrador de clínica)
router.post('/:id/servicios', autorizarRoles(['administrador de clínica']), async (req, res) => {
    try {
        const { id } = req.params;
        const { servicioId } = req.body;
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;

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

        if (error.message && error.message.includes('no posee la especialidad requerida')) {
            return res.status(400).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.code === '23505') {
            return res.status(409).json({
                status: 'error',
                message: 'El servicio ya está asociado al profesional.'
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});

// PUT /api/profesionales/:id - Actualizar datos del profesional (Solo Administrador de clínica)
router.put('/:id', autorizarRoles(['administrador de clínica']), async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;

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

        if (
            error.message &&
            (error.message.includes('Solo el administrador') ||
             error.message.includes('Solo un administrador'))
        ) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        if (
            error.message &&
            (error.message.includes('no está asociado activamente') ||
             error.message.includes('Profesional no encontrado'))
        ) {
            return res.status(404).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('especialidades son inválidas')) {
            return res.status(400).json({
                status: 'error',
                message: error.message
            });
        }

        if (
            error.code === '23505' ||
            (error.message &&
             (error.message.includes('citas futuras reservadas') ||
              error.message.includes('profesional compartido') ||
              error.message.includes('retirar especialidades')))
        ) {
            return res.status(409).json({
                status: 'error',
                message: error.code === '23505'
                    ? 'La identificación, correo o colegiado ya se encuentra registrado.'
                    : error.message
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});

// DELETE /api/profesionales/:id - Desactivar profesional (baja lógica) (Solo Administrador de clínica)
router.delete('/:id', autorizarRoles(['administrador de clínica']), async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;

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

        if (error.message && error.message.includes('no está asociado activamente')) {
            return res.status(404).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message && error.message.includes('citas futuras reservadas')) {
            return res.status(409).json({
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
