jest.mock('../../services/admin-clinica/src/repositorios/usuarios_repos', () => ({
    crearUsuario: jest.fn(),
    cambiarRolUsuario: jest.fn(),
    desactivarUsuario: jest.fn(),
    obtenerUsuarios: jest.fn()
}));

const usuariosService = require('../../services/admin-clinica/src/servicios/usuarios_servicio');
const usuariosRepositorio = require('../../services/admin-clinica/src/repositorios/usuarios_repos');

describe('Pruebas unitarias del servicio de usuarios', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const datosValidos = {
        providerId: 'nuevo-usuario',
        roleId: 3,
        identificacion: '123456789',
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'juan@test.com',
        telefono: '88887777'
    };

    test('1. Crear usuario correctamente', async () => {
        const usuario = { userId: 10, nombre: 'Juan' };
        usuariosRepositorio.crearUsuario.mockResolvedValue(usuario);

        const resultado = await usuariosService.crearUsuario(
            datosValidos, 1, 5
        );

        expect(resultado).toEqual({ usuario });
        expect(usuariosRepositorio.crearUsuario).toHaveBeenCalledWith(
            datosValidos, 1, 5
        );
    });

    test('2. Rechazar la creación con datos inválidos', async () => {
        const resultado = await usuariosService.crearUsuario(
            { ...datosValidos, providerId: ' ' }, 1, 5
        );

        expect(resultado).toEqual({
            error: 'El providerId (Keycloak username) es obligatorio.',
            status: 400
        });
        expect(usuariosRepositorio.crearUsuario).not.toHaveBeenCalled();
    });

    test('3. Cambiar el rol correctamente', async () => {
        const usuario = { userId: 10, roleId: 4 };
        usuariosRepositorio.cambiarRolUsuario.mockResolvedValue(usuario);

        const resultado = await usuariosService.cambiarRolUsuario(
            '10', '4', 1, 5
        );

        expect(resultado).toEqual({ usuario });
        expect(usuariosRepositorio.cambiarRolUsuario).toHaveBeenCalledWith(
            10, 4, 1, 5
        );
    });

    test('4. Rechazar un cambio de rol con datos inválidos', async () => {
        const resultado = await usuariosService.cambiarRolUsuario(
            'abc', 8, 1, 5
        );

        expect(resultado).toEqual({
            error: 'El ID de usuario debe ser un entero positivo.',
            status: 400
        });
        expect(usuariosRepositorio.cambiarRolUsuario).not.toHaveBeenCalled();
    });

    test('5. Desactivar usuario correctamente', async () => {
        const respuesta = { desactivado: true };
        usuariosRepositorio.desactivarUsuario.mockResolvedValue(respuesta);

        const resultado = await usuariosService.desactivarUsuario(
            '10', 1, 5
        );

        expect(resultado).toEqual({ resultado: respuesta });
        expect(usuariosRepositorio.desactivarUsuario).toHaveBeenCalledWith(
            10, 1, 5
        );
    });

    test('6. Rechazar la desactivación con un ID inválido', async () => {
        const resultado = await usuariosService.desactivarUsuario(
            '0', 1, 5
        );

        expect(resultado).toEqual({
            error: 'El ID de usuario debe ser un entero positivo.',
            status: 400
        });
        expect(usuariosRepositorio.desactivarUsuario).not.toHaveBeenCalled();
    });

    test('7. Obtener usuarios correctamente', async () => {
        const usuarios = [{ userId: 10 }, { userId: 11 }];
        usuariosRepositorio.obtenerUsuarios.mockResolvedValue(usuarios);

        const resultado = await usuariosService.obtenerUsuarios(1, 5);

        expect(resultado).toEqual({ usuarios });
        expect(usuariosRepositorio.obtenerUsuarios).toHaveBeenCalledWith(1, 5);
    });
});
