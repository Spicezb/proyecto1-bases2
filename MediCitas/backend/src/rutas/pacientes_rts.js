const express = require('express');
const router = express.Router();
const pacientesService = require('../servicios/pacientes_servicio');

// GET /api/pacientes, lista todos los pacientes
router.get('/', (req, res) => {
    const pacientes = pacientesService.obtenerPacientes();
    res.status(200).json(pacientes);
});

// Get consultar paciente: api/pacientes/:id
router.get('/:id', (req, res) => {
    const paciente = pacientesService.obtenerPacientePorId(req.params.id);

    if (!paciente) {
        return res.status(404).json({
            status: 'error',
            message: 'Paciente no encontrado.'
        });
    }
    res.status(200).json(paciente);
});

// POST /api/pacientes, crea un nuevo paciente
router.post('/', (req, res) => {
    const resultado = pacientesService.registrarPaciente(req.body);

    if (resultado.error) {
        return res.status(400).json({
            status: 'error',
            message: resultado.error
        });
    }
    res.status(201).json(resultado.paciente);
});

// PUT /api/pacientes/:id, actualiza un paciente existente
router.put('/:id', (req, res) => {
    const resultado = pacientesService.actualizarPaciente(
        req.params.id,
        req.body
    );

    if (resultado.error) {
        return res.status(resultado.status).json({
            status: 'error',
            message: resultado.error
        });
    }
    res.status(200).json(resultado.paciente);
});

module.exports = router;