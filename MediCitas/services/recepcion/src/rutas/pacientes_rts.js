const express = require('express');
const router = express.Router();
const pacientesService = require('../servicios/pacientes_servicio');
const { autorizarRoles } = require('../middlewares/roles');

// GET /api/pacientes - Consultar pacientes de una clínica (Adm. clínica, Recepción, Profesional solo lectura)
router.get('/', autorizarRoles(['administrador de clínica', 'recepción', 'profesional de salud']), async (req, res) => {
    try {
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;

        const pacientes = await pacientesService.obtenerPacientes(clinicId, auditPersonId);

        res.status(200).json(pacientes);
    } catch (error) {
        console.error('Error al consultar pacientes:', error);

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

// GET /api/pacientes/:id para consultar un paciente
router.get('/:id', autorizarRoles(['administrador de clínica', 'recepción', 'profesional de salud']), async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;

        if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                status: 'error',
                message: 'El ID del paciente debe ser un entero positivo.'
            });
        }
        const paciente = await pacientesService.obtenerPacientePorId(
            id,
            clinicId,
            auditPersonId
        );

        if (!paciente) {
            return res.status(404).json({
                status: 'error',
                message: 'Paciente no encontrado.'
            });
        }
        res.status(200).json(paciente);

    } catch (error) {
        console.error('Error al consultar paciente:', error);

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

// POST /api/pacientes - Registrar paciente (Recepción y Adm. clínica)
router.post('/', autorizarRoles(['recepción', 'administrador de clínica']), async (req, res) => {
    try {
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;

        const resultado = await pacientesService.registrarPaciente(
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
        res.status(201).json(resultado.paciente);

    } catch (error) {
        console.error('Error al consultar pacientes:', error);

        if (
            error.code === '23505' ||
            error.message.includes('ya se encuentra registrado') ||
            error.message.includes('identificación ya existe')
        ) {
            return res.status(409).json({
                status: 'error',
                message: error.message
            });
        }

        if (
            error.message.includes('Solo recepción')
        ) {
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

// PUT /api/pacientes/:id - Actualizar paciente (Recepción y Adm. clínica)
router.put('/:id', autorizarRoles(['recepción', 'administrador de clínica']), async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;

        const resultado = await pacientesService.actualizarPaciente(
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
        res.status(200).json(resultado.paciente);
    } catch (error) {
        console.error('Error al actualizar paciente:', error);

        if (
            error.code === '23505' ||
            error.message.includes('identificación')
        ) {
            return res.status(409).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message.includes('Solo recepción')) {
            return res.status(403).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message.includes('Paciente no encontrado')) {
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
