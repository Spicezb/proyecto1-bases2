const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const pacientesRoutes = require('./rutas/pacientes_rts');

app.use(express.json());
app.use('/api/pacientes', pacientesRoutes);

// GET /health - Verifica que la aplicación esté viva
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok'
    });
});

// Middleware para manejar errores
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            status: 'error',
            message: 'Entrada mal formada'
        });
    }

    console.error(err);

    res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
    });
});

// Inicia el servidor
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en puerto ${PORT}`);
    });
}

module.exports = app;