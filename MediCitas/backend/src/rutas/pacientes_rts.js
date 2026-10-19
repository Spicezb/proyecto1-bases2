const express = require('express');
const router = express.Router();

// GET /api/pacientes, este con datos para probar la ruta
router.get('/', (req, res) => {
    res.status(200).json([
        { id: 1, nombre: 'Ana' },
        { id: 2, nombre: 'Carlos' }
    ]);
});

module.exports = router;