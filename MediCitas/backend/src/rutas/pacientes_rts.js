const express = require('express');
const router = express.Router();
const pacientesService = require('../servicios/pacientes_servicio');

// GET /api/pacientes - Consultar pacientes de una clínica
router.get('/', async (req, res) => {
    try {
        const clinicId = 1; // Temporal para pruebas locales
        const pacientes = await pacientesService.obtenerPacientes(clinicId);

        res.status(200).json(pacientes);
    } catch (error) {
        console.error('Error al consultar pacientes:', error);

        res.status(500).json({
            status: 'error',
            message: 'Error al consultar pacientes.'
        });
    }
});

// GET /api/pacientes/:id para consultar un paciente
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = 1; // Temporal para pruebas locales

        if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                status: 'error',
                message: 'El ID del paciente debe ser un entero positivo.'
            });
        }
        const paciente = await pacientesService.obtenerPacientePorId(
            id,
            clinicId
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

        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});


// POST /api/pacientes - Registrar paciente
router.post('/', async (req, res) => {
    try {
        const clinicId = 1; //Temporal para pruebas locales

        const resultado = await pacientesService.registrarPaciente(
            req.body,
            clinicId
        );
        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }
        res.status(201).json(resultado.paciente);

    } catch (error) {
        console.error('Error al registrar paciente:', error);
        if (error.status === 409 || error.code === '23505') {
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

// PUT /api/pacientes/:id - Actualizar paciente
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = 1; //Temporal para desarrollo local
        const resultado = await pacientesService.actualizarPaciente(
            id,
            req.body,
            clinicId
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
        if (error.status === 404 || error.status === 409) {
            return res.status(error.status).json({
                status: 'error',
                message: error.message
            });
        }
        if (error.code === '23505') {
            return res.status(409).json({
                status: 'error',
                message: 'La identificación ya está registrada.'
            });
        }
        return res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});

module.exports = router;