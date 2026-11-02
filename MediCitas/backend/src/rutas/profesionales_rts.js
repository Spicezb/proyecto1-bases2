const express = require('express');
const router = express.Router();

const profesionalesService = require('../servicios/profesionales_servicio');

// GET /api/profesionales
router.get('/', async (req, res) => {
    try {
        const clinicId = 1; //Temporal para pruebas locales

        const profesionales =
            await profesionalesService.obtenerProfesionales(clinicId);

        return res.status(200).json(profesionales);

    } catch (error) {
        console.error('Error al consultar profesionales:', error);

        return res.status(500).json({
            status: 'error',
            message: 'Error al consultar profesionales.'
        });
    }
});

// GET /api/profesionales/:id
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = 1; //Temporal para pruebas locales

        if (
            !/^[1-9]\d*$/.test(id) ||
            !Number.isSafeInteger(Number(id))
        ) {
            return res.status(400).json({
                status: 'error',
                message: 'El ID debe ser un entero positivo.'
            });
        }
        const profesional =
            await profesionalesService.obtenerProfesionalPorId(
                Number(id),
                clinicId
            );

        if (!profesional) {
            return res.status(404).json({
                status: 'error',
                message: 'Profesional no encontrado.'
            });
        }

        return res.status(200).json(profesional);

    } catch (error) {
        console.error('Error al consultar profesional:', error);

        return res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});


router.post('/', async (req, res) => {
    try {
        const clinicId = 1; // Temporal para pruebas locales

        const resultado = await profesionalesService.registrarProfesional(
            req.body,
            clinicId
        );

        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }

        return res.status(201).json(resultado.profesional);

    } catch (error) {
        console.error('Error al registrar profesional:', error);

        if (error.status) {
            return res.status(error.status).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.code === '23505') {
            return res.status(409).json({
                status: 'error',
                message: 'La licencia o asociación profesional ya existe.'
            });
        }

        if (error.code === '23503') {
            return res.status(400).json({
                status: 'error',
                message: 'Existe una referencia inválida en los datos.'
            });
        }

        return res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});

// GET /api/profesionales/:id/servicios
router.get('/:id/servicios', async (req, res) => {
    try {
        const clinicId = 1;

        const resultado =
            await profesionalesService.obtenerServiciosProfesional(
                req.params.id,
                clinicId
            );

        if (resultado.error) {
            return res.status(resultado.status).json({
                status: 'error',
                message: resultado.error
            });
        }

        return res.status(200).json(resultado.servicios);

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: 'error',
            message: 'Error al consultar servicios del profesional.'
        });
    }
});

// POST /api/profesionales/:id/servicios
router.post('/:id/servicios', async (req, res) => {
    try {
        const clinicId = 1;

        const resultado =
            await profesionalesService.asociarServicio(
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

        return res.status(201).json(resultado.asociacion);

    } catch (error) {
        console.error(error);

        if (error.status === 400 || error.status === 409) {
            return res.status(error.status).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.code === '23505') {
            return res.status(409).json({
                status: 'error',
                message: 'La asociación ya existe.'
            });
        }

        return res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});

// DELETE /api/profesionales/:id/servicios/:servicioId
router.delete('/:id/servicios/:servicioId', async (req, res) => {
    try {
        const clinicId = 1;

        const resultado =
            await profesionalesService.desasociarServicio(
                req.params.id,
                req.params.servicioId,
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
        console.error(error);
        return res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor.'
        });
    }
});


const manejarErrorProfesional = (error, res) => {
    console.error('Error en profesionales:', error);

    if (error.status) {
        return res.status(error.status).json({
            status: 'error',
            message: error.message
        });
    }

    if (error.code === '23505') {
        return res.status(409).json({
            status: 'error',
            message: 'La licencia ya está registrada.'
        });
    }

    return res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor.'
    });
};

// PUT /api/profesionales/:id
router.put('/:id', async (req, res) => {
    try {
        const clinicId = 1; // Temporal para pruebas locales

        const resultado =
            await profesionalesService.actualizarProfesional(
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

        return res.status(200).json(resultado.profesional);

    } catch (error) {
        return manejarErrorProfesional(error, res);
    }
});

// DELETE /api/profesionales/:id
router.delete('/:id', async (req, res) => {
    try {
        const clinicId = 1; // Temporal para pruebas locales

        const resultado =
            await profesionalesService.eliminarProfesional(
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
        return manejarErrorProfesional(error, res);
    }
});

module.exports = router;