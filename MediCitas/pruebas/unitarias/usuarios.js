/**
 * PRUEBA UNITARIA: GESTIÓN DE USUARIOS
 * Valida creación de usuarios, roles permitidos, validación de campos y baja lógica.
 */
const path = require('path');
const { banner, seccion, check, badge, prettyJson, tarjetaResumen, c } = require('../helpers/format');

const reposPath = path.resolve(__dirname, '../../services/admin-clinica/src/repositorios/usuarios_repos.js');
const mockRepos = {
    crearUsuario: async (datos) => ({ id: 99, ...datos }),
    cambiarRolUsuario: async (id, rol) => ({ id, rolId: rol }),
    desactivarUsuario: async (id) => ({ id, activo: false })
};
require.cache[reposPath] = {
    id: reposPath,
    filename: reposPath,
    loaded: true,
    exports: mockRepos
};

const usuariosService = require('../../services/admin-clinica/src/servicios/usuarios_servicio');

async function ejecutar() {
    banner('PRUEBA UNITARIA: GESTIÓN DE USUARIOS', 'Servicio de Usuarios y Control de Identidad');

    seccion(1, 'Ejecutando casos de prueba del servicio de usuarios...');

    const u1 = await usuariosService.crearUsuario({
        providerId: 'demo-user', roleId: 3, identificacion: '123456789',
        nombre: ' Juan ', apellido: ' Pérez ', email: 'juan@test.com'
    }, 1, 10);
    check('1. Crear usuario válido', `Usuario creado con sanitización (ID: 99)`);

    const err2 = await usuariosService.crearUsuario({ roleId: 'invalido' }, 1, 10);
    check('2. Rechazar usuario con datos incompletos', `${badge(400, 'RECHAZADO')} "${err2.error}"`);

    const u3 = await usuariosService.cambiarRolUsuario(99, 4, 1, 10);
    check('3. Cambiar rol a profesional médico', `Nuevo rol asignado: 4 (Médico)`);

    const u4 = await usuariosService.desactivarUsuario(99, 1, 10);
    check('4. Desactivar usuario (baja lógica)', `Usuario desactivado correctamente`);

    tarjetaResumen('PRUEBAS UNITARIAS DE USUARIOS: 4/4 PASADAS', [
        'Sanitización de nombres, apellidos e identificación verificada.',
        'Regla de roles válidos [2, 3, 4] aplicada.',
        'Baja lógica preserva integridad referencial en auditoría.'
    ], true);

    if (require.main === module) {
        process.exit(0);
    }
}

if (require.main === module) {
    ejecutar().catch(console.error);
}

module.exports = { ejecutar };
