const express = require('express');

const app = express();
const PORT = process.env.PORT || 3004;

const { autenticarToken } = require('./middlewares/auth');

const miagendaRoutes = require('./rutas/miagenda_rts');
const notasRoutes = require('./rutas/notas_rts');

app.use(express.json());

// Healthcheck
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'profesional' });
});

// Autenticación OIDC obligatoria
app.use('/api', autenticarToken);

// Rutas de Profesional de Salud
app.use('/api/mi-agenda', miagendaRoutes);
app.use('/api/notas', notasRoutes);

// Ruta no encontrada
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Ruta no encontrada.'
    });
});

// Manejador de errores
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            status: 'error',
            message: 'Entrada mal formada.'
        });
    }

    console.error(err);
    res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor.'
    });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Servicio Profesional de Salud corriendo en puerto ${PORT}`);
    });
}

module.exports = app;
