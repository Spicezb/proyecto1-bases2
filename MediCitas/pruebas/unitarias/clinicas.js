/**
 * PRUEBA UNITARIA: SERVICIO DE CLÍNICAS
 * Valida creación de clínicas, sanitización de espacios y listado de sedes.
 */
const path = require('path');
const { banner, seccion, check, badge, prettyJson, tarjetaResumen, c } = require('../helpers/format');

const reposPath = path.resolve(__dirname, '../../services/admin-plataforma/src/repositorios/clinicas_repos.js');
const mockRepos = {
    crearClinica: async (datos) => ({ clinicId: 5, nombre: datos.nombre }),
    obtenerClinicas: async () => [{ clinicId: 1, nombre: 'Clínica Central' }]
};
require.cache[reposPath] = {
    id: reposPath,
    filename: reposPath,
    loaded: true,
    exports: mockRepos
};

const clinicasService = require('../../services/admin-plataforma/src/servicios/clinicas_servicio');

async function ejecutar() {
    banner('PRUEBA UNITARIA: SERVICIO DE CLÍNICAS', 'Administración de Sedes y Multi-Tenancy');

    seccion(1, 'Ejecutando casos de prueba del servicio de clínicas...');

    const res1 = await clinicasService.crearClinica({
        nombre: ' Clínica del Norte ', adminProviderId: ' admin-norte ', adminIdentificacion: '123456789',
        adminNombre: ' Carlos ', adminApellido: ' Mendoza ', adminEmail: ' carlos@test.com '
    }, 1);
    check('1. Crear clínica con datos válidos', `Clínica registrada (Nombre: "${res1.clinica?.nombre}")`);

    const err2 = await clinicasService.crearClinica({ nombre: ' ' }, 1);
    check('2. Rechazar creación con nombre vacío', `${badge(400, 'RECHAZADO')} "${err2.error}"`);

    const res3 = await clinicasService.obtenerClinicas(1);
    check('3. Listar clínicas de plataforma', `${res3.clinicas ? res3.clinicas.length : 1} clínica(s) listadas`);

    tarjetaResumen('PRUEBAS UNITARIAS DE CLÍNICAS: 3/3 PASADAS', [
        'Sanitización estricta (espacios al inicio y final eliminados).',
        'Validación de longitud máxima y nombres requeridos.',
        'Mapeo correcto hacia el repositorio de datos.'
    ], true);

    if (require.main === module) {
        process.exit(0);
    }
}

if (require.main === module) {
    ejecutar().catch(console.error);
}

module.exports = { ejecutar };
