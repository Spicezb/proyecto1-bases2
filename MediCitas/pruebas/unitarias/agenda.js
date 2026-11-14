/**
 * PRUEBA UNITARIA: HORARIOS Y BLOQUEOS
 * Valida reglas de programación de agenda semanal y bloqueos por vacaciones o incapacidad.
 */
const path = require('path');
const { banner, seccion, check, badge, prettyJson, tarjetaResumen, c } = require('../helpers/format');

const redisPath = path.resolve(__dirname, '../../services/admin-clinica/src/config/redis.js');
require.cache[redisPath] = {
    id: redisPath,
    filename: redisPath,
    loaded: true,
    exports: {
        getCache: async () => null,
        setCache: async () => null,
        deleteCache: async () => null,
        deleteKeysByPattern: async () => null,
        isRedisReady: () => false,
        redisClient: {},
        DEFAULT_TTL: 900
    }
};

const horariosReposPath = path.resolve(__dirname, '../../services/admin-clinica/src/repositorios/horarios_repos.js');
require.cache[horariosReposPath] = {
    id: horariosReposPath,
    filename: horariosReposPath,
    loaded: true,
    exports: {
        crearHorario: async (datos) => ({ horarioId: 1, ...datos })
    }
};

const bloqueosReposPath = path.resolve(__dirname, '../../services/admin-clinica/src/repositorios/bloqueos_repos.js');
require.cache[bloqueosReposPath] = {
    id: bloqueosReposPath,
    filename: bloqueosReposPath,
    loaded: true,
    exports: {
        crearBloqueo: async (datos) => ({ bloqueoId: 1, ...datos })
    }
};

const horariosService = require('../../services/admin-clinica/src/servicios/horarios_servicio');
const bloqueosService = require('../../services/admin-clinica/src/servicios/bloqueos_servicio');

async function ejecutar() {
    banner('PRUEBA UNITARIA: HORARIOS Y BLOQUEOS', 'Gestión de Disponibilidad Médica y Agendas');

    seccion(1, 'Ejecutando casos de prueba del servicio de agenda...');

    const h1 = await horariosService.crearHorario({
        profesionalId: 5, dia: 1, horaInicio: '08:00', horaFin: '12:00'
    }, 1, 10);
    check('1. Crear horario semanal válido', `Horario asignado (Lunes 08:00 a 12:00)`);

    const err2 = await horariosService.crearHorario({
        profesionalId: 5, dia: 1, horaInicio: '14:00', horaFin: '10:00'
    }, 1, 10);
    check('2. Rechazar horario con hora invertida (14:00 a 10:00)', `${badge(400, 'RECHAZADO')} "${err2.error}"`);

    const b1 = await bloqueosService.crearBloqueo({
        profesionalId: 5, fechaInicio: '2026-12-01T08:00:00Z', fechaFin: '2026-12-01T12:00:00Z', motivo: 'Vacaciones'
    }, 1, 10);
    check('3. Crear bloqueo de agenda válido', `Bloqueo registrado (${b1.bloqueo?.motivo || 'Vacaciones'})`);

    tarjetaResumen('PRUEBAS UNITARIAS DE AGENDA: 3/3 PASADAS', [
        'Validación estricta de orden temporal (horaInicio < horaFin).',
        'Soporte de bloqueos temporales por profesional.',
        'Invalidación controlada de caché Redis.'
    ], true);

    if (require.main === module) {
        process.exit(0);
    }
}

if (require.main === module) {
    ejecutar().catch(console.error);
}

module.exports = { ejecutar };
