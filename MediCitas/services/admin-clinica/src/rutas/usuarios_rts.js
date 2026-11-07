const express = require('express');
const router = express.Router();
const usuariosService = require('../servicios/usuarios_servicio');
const { autorizarRoles } = require('../middlewares/roles');

// GET /api/usuarios - Consultar usuarios de la clínica
router.get('/', autorizarRoles(['administrador de clínica']), async (req, res) => {
    try {
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;

        const resultado = await usuariosService.obtenerUsuarios(clinicId, auditPersonId);
        res.status(200).json(resultado.usuarios);
    } catch (error) {
        console.error('Error al consultar usuarios:', error);
        res.status(500).json({ status: 'error', message: 'Error interno del servidor.' });
    }
});

// POST /api/usuarios - RF2: Crear usuario
router.post('/', autorizarRoles(['administrador de clínica']), async (req, res) => {
    try {
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;

        const resultado = await usuariosService.crearUsuario(req.body, clinicId, auditPersonId);
        if (resultado.error) {
            return res.status(resultado.status).json({ status: 'error', message: resultado.error });
        }
        res.status(201).json(resultado.usuario);
    } catch (error) {
        console.error('Error al crear usuario:', error);
        if (error.code === '23505') {
            return res.status(409).json({ status: 'error', message: 'El usuario ya existe con ese identificador o cédula.' });
        }
        res.status(500).json({ status: 'error', message: 'Error interno del servidor.' });
    }
});

// PUT /api/usuarios/:id/rol - RF2: Cambiar rol de usuario
router.put('/:id/rol', autorizarRoles(['administrador de clínica']), async (req, res) => {
    try {
        const { id } = req.params;
        const { roleId } = req.body;
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;

        const resultado = await usuariosService.cambiarRolUsuario(id, roleId, clinicId, auditPersonId);
        if (resultado.error) {
            return res.status(resultado.status).json({ status: 'error', message: resultado.error });
        }
        res.status(200).json(resultado.usuario);
    } catch (error) {
        console.error('Error al cambiar rol:', error);
        res.status(500).json({ status: 'error', message: 'Error interno del servidor.' });
    }
});

// DELETE /api/usuarios/:id - RF2: Baja lógica de usuario
router.delete('/:id', autorizarRoles(['administrador de clínica']), async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;

        const resultado = await usuariosService.desactivarUsuario(id, clinicId, auditPersonId);
        if (resultado.error) {
            return res.status(resultado.status).json({ status: 'error', message: resultado.error });
        }
        res.status(200).json({ status: 'ok', message: 'Usuario desactivado correctamente.', data: resultado.resultado });
    } catch (error) {
        console.error('Error al desactivar usuario:', error);
        res.status(500).json({ status: 'error', message: 'Error interno del servidor.' });
    }
});

module.exports = router;
