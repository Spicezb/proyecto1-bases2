const express = require('express');

const app = express();
const PORT = process.env.PORT || 3001;

const { autenticarToken } = require('./middlewares/auth');
const clinicasRoutes = require('./rutas/clinicas_rts');

app.use(express.json());

// Healthcheck
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'admin-plataforma' });
});

// Autenticación OIDC obligatoria
app.use('/api', autenticarToken);

// Rutas de administración de plataforma
app.use('/api/clinicas', clinicasRoutes);

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
        console.log(`Servicio Admin Plataforma corriendo en puerto ${PORT}`);
    });
}

module.exports = app;
