const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const { autenticarToken } = require('./middlewares/auth');

const pacientesRoutes = require('./rutas/pacientes_rts');
const serviciosRoutes = require('./rutas/servicios_rts');
const profesionalesRoutes = require('./rutas/profesionales_rts');
const horariosRoutes = require('./rutas/horarios_rts');
const bloqueosRoutes = require('./rutas/bloqueos_rts');
const disponibilidadRoutes = require('./rutas/disponibilidad_rts');
const citasRoutes = require('./rutas/citas_rts');

app.use(express.json());

// GET /health - Verifica que la aplicación esté viva (Público)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok'
    });
});

// Middleware de Autenticación OIDC para toda la API
app.use('/api', autenticarToken);

// Rutas de la API protegidas
app.use('/api/pacientes', pacientesRoutes);
app.use('/api/servicios', serviciosRoutes);
app.use('/api/profesionales', profesionalesRoutes);
app.use('/api/horarios', horariosRoutes);
app.use('/api/bloqueos', bloqueosRoutes);
app.use('/api/disponibilidad', disponibilidadRoutes);
app.use('/api/citas', citasRoutes);

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
