const express = require('express');

const app = express();
const PORT = process.env.PORT || 3002;

const { autenticarToken } = require('./middlewares/auth');

const usuariosRoutes = require('./rutas/usuarios_rts');
const serviciosRoutes = require('./rutas/servicios_rts');
const profesionalesRoutes = require('./rutas/profesionales_rts');
const horariosRoutes = require('./rutas/horarios_rts');
const bloqueosRoutes = require('./rutas/bloqueos_rts');
const auditoriaRoutes = require('./rutas/auditoria_rts');

app.use(express.json());

const { isRedisReady } = require('./config/redis');

// Healthcheck
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'admin-clinica',
        redis: isRedisReady() ? 'connected' : 'disconnected'
    });
});

// Autenticación OIDC obligatoria
app.use('/api', autenticarToken);

// Rutas del Administrador de Clínica
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/servicios', serviciosRoutes);
app.use('/api/profesionales', profesionalesRoutes);
app.use('/api/horarios', horariosRoutes);
app.use('/api/bloqueos', bloqueosRoutes);
app.use('/api/auditoria', auditoriaRoutes);

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
        console.log(`Servicio Admin Clínica corriendo en puerto ${PORT}`);
    });
}

module.exports = app;
