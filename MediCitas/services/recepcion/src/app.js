const express = require('express');

const app = express();
const PORT = process.env.PORT || 3003;

const { autenticarToken } = require('./middlewares/auth');

const pacientesRoutes = require('./rutas/pacientes_rts');
const citasRoutes = require('./rutas/citas_rts');
const disponibilidadRoutes = require('./rutas/disponibilidad_rts');

app.use(express.json());

// Healthcheck
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'recepcion' });
});

// Autenticación OIDC obligatoria
app.use('/api', autenticarToken);

// Rutas de Recepción
app.use('/api/pacientes', pacientesRoutes);
app.use('/api/citas', citasRoutes);
app.use('/api/disponibilidad', disponibilidadRoutes);

// Manejador de errores
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

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Servicio Recepción corriendo en puerto ${PORT}`);
    });
}

module.exports = app;
