const express = require('express');
const router = express.Router();
const auditoriaService = require('../servicios/auditoria_servicio');
const { autorizarRoles } = require('../middlewares/roles');

// GET /api/auditoria - RF19: Consultar bitácora de auditoría (Solo Administrador de clínica)
router.get('/', autorizarRoles(['administrador de clínica']), async (req, res) => {
    try {
        const clinicId = req.user.clinicId;
        const auditPersonId = req.user.userId;

        const resultado = await auditoriaService.consultarLogs(clinicId, auditPersonId, req.query);
        res.status(200).json(resultado.logs);
    } catch (error) {
        console.error('Error al consultar auditoría:', error);
        if (error.message && error.message.includes('Acceso denegado')) {
            return res.status(403).json({ status: 'error', message: error.message });
        }
        res.status(500).json({ status: 'error', message: 'Error interno del servidor.' });
    }
});

module.exports = router;
