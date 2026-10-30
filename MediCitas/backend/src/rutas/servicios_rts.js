const express = require('express');
const router = express.Router();

const serviciosService = require('../servicios/servicios_servicio');

// GET /api/servicios - Consultar servicios médicos
router.get('/', async (req, res) => {
    try {
        const clinicId = 1; //Temporal para pruebas locales
        const servicios = await serviciosService.obtenerServicios(clinicId);
        res.status(200).json(servicios);
    } catch (error) {
        console.error('Error al consultar servicios:', error);

        res.status(500).json({
            status: 'error',
            message: 'Error al consultar servicios médicos.'
        });
    }
});

// GET /api/servicios/:id - Consultar un servicio médico
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = 1; //Temporal para pruebas locales
        
        if (!/^[1-9]\d*$/.test(id) ||
            !Number.isSafeInteger(Number(id))) {
            return res.status(400).json({
                status: 'error',
                message: 'El ID debe ser un entero positivo.'
            });
        }
        const servicio = await serviciosService.obtenerServicioPorId(
            id,
            clinicId
        );
        if (!servicio) {
            return res.status(404).json({
                status: 'error',
                message: 'Servicio médico no encontrado.'
            });
        }
        res.status(200).json(servicio);
    } catch (error) {
        console.error('Error al consultar servicio:', error);

        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});

// POST /api/servicios - Registrar servicio médico
router.post('/', async (req, res) => {
    try {
        const clinicId = 1; //Temporal para pruebas locales

        const resultado = await serviciosService.registrarServicio(
            req.body,
            clinicId
        );
        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }

        return res.status(201).json(resultado.servicio);
    } catch (error) {
        console.error('Error al registrar servicio:', error);

        if (error.status === 404 || error.status === 409) {
            return res.status(error.status).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.code === '23505') {
            return res.status(409).json({
                status: 'error',
                message: 'El servicio ya existe o hubo un conflicto.'
            });
        }

        return res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});

// PUT /api/servicios/:id - Actualizar duración
router.put('/:id', async (req, res) => {
    try {
        const clinicId = 1; //Temporal para pruebas locales
        const resultado = await serviciosService.actualizarServicio(
            req.params.id,
            req.body,
            clinicId
        );

        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }
        return res.status(200).json(resultado.servicio);

    } catch (error) {
        console.error('Error al actualizar servicio:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});

//DELETE /api/servicios/:id - Baja lógica
router.delete('/:id', async (req, res) => {
    try {
        const clinicId = 1; //Temporal para pruebas locales

        const resultado = await serviciosService.eliminarServicio(
            req.params.id,
            clinicId
        );
        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }
        return res.status(204).send();

    } catch (error) {
        console.error('Error al eliminar servicio:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});

module.exports = router;
