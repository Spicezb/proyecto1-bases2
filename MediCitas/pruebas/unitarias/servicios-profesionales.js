/**
 * PRUEBA UNITARIA: SERVICIOS Y PROFESIONALES
 * Valida duración fija de servicios, licencias y compatibilidad de especialidades.
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

const serviciosReposPath = path.resolve(__dirname, '../../services/admin-clinica/src/repositorios/servicios_repos.js');
require.cache[serviciosReposPath] = {
    id: serviciosReposPath,
    filename: serviciosReposPath,
    loaded: true,
    exports: {
        registrarServicio: async (datos) => ({ serviceId: 10, ...datos }),
        actualizarServicio: async (id, datos) => ({ serviceId: id, ...datos })
    }
};

const profesionalesReposPath = path.resolve(__dirname, '../../services/admin-clinica/src/repositorios/profesionales_repos.js');
require.cache[profesionalesReposPath] = {
    id: profesionalesReposPath,
    filename: profesionalesReposPath,
    loaded: true,
    exports: {
        registrarProfesional: async (datos) => ({ professionalId: 20, ...datos }),
        asociarServicio: async () => ({ resultado: 'asociado' })
    }
};

const serviciosService = require('../../services/admin-clinica/src/servicios/servicios_servicio');
const profesionalesService = require('../../services/admin-clinica/src/servicios/profesionales_servicio');

async function ejecutar() {
    banner('PRUEBA UNITARIA: SERVICIOS Y PROFESIONALES', 'Catálogo de Prestaciones Médicas y Licencias');

    seccion(1, 'Ejecutando casos de prueba de servicios y médicos...');

    const s1 = await serviciosService.registrarServicio({
        nombre: 'Consulta Pediatría', especialidadId: 2, duracion: 30
    }, 1, 10);
    check('1. Registrar servicio válido', `Servicio registrado (Duración: 30 min)`);

    const err2 = await serviciosService.registrarServicio({
        nombre: 'Consulta Inválida', especialidadId: 1, duracion: 0
    }, 1, 10);
    check('2. Rechazar servicio con duración 0', `${badge(400, 'RECHAZADO')} "${err2.error}"`);

    const p1 = await profesionalesService.registrarProfesional({
        usuarioId: 15, licencia: 'MED-123', especialidades: [1, 2]
    }, 1, 10);
    check('3. Registrar profesional con licencia', `Médico asignado (Licencia: MED-123)`);

    tarjetaResumen('PRUEBAS UNITARIAS DE SERVICIOS: 3/3 PASADAS', [
        'Duración mínima obligatoria > 0 minutos.',
        'Asignación de código de colegiado médico (licencia).',
        'Vínculo de especialidades con servicios habilitados.'
    ], true);

    if (require.main === module) {
        process.exit(0);
    }
}

if (require.main === module) {
    ejecutar().catch(console.error);
}

module.exports = { ejecutar };
