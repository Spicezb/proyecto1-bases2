
jest.mock('../../services/admin-clinica/src/repositorios/servicios_repos', () => ({
    registrarServicio: jest.fn(),
    actualizarServicio: jest.fn()
}));

jest.mock('../../services/admin-clinica/src/repositorios/profesionales_repos', () => ({
    registrarProfesional: jest.fn(),
    asociarServicio: jest.fn()
}));

const serviciosService = require('../../services/admin-clinica/src/servicios/servicios_servicio');
const profesionalesService = require('../../services/admin-clinica/src/servicios/profesionales_servicio');

const serviciosRepositorio = require('../../services/admin-clinica/src/repositorios/servicios_repos');
const profesionalesRepositorio = require('../../services/admin-clinica/src/repositorios/profesionales_repos');

describe('Pruebas unitarias de servicios y profesionales', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('1. Registrar servicio correctamente', async () => {
        const datos = {
            nombre: 'Consulta general',
            especialidadId: 1,
            duracion: 30
        };

        const servicio = { serviceId: 1, nombre: 'Consulta general' };

        serviciosRepositorio.registrarServicio.mockResolvedValue(servicio);

        const resultado = await serviciosService.registrarServicio(datos, 1, 5);

        expect(resultado).toEqual({ servicio });
        expect(serviciosRepositorio.registrarServicio).toHaveBeenCalledWith(
            datos, 1, 5
        );
    });

    test('2. Rechazar registro de servicio inválido', async () => {
        const resultado = await serviciosService.registrarServicio({
            nombre: 'Consulta general',
            especialidadId: 1,
            duracion: 0
        }, 1, 5);

        expect(resultado).toEqual({
            error: 'La duración debe ser un número entero positivo mayor a cero (en minutos).',
            status: 400
        });

        expect(serviciosRepositorio.registrarServicio).not.toHaveBeenCalled();
    });

    test('3. Actualizar servicio correctamente', async () => {
        const servicio = { serviceId: 1, duracion: 45 };

        serviciosRepositorio.actualizarServicio.mockResolvedValue(servicio);

        const resultado = await serviciosService.actualizarServicio(
            '1', { duracion: 45, activo: true }, 1, 5
        );

        expect(resultado).toEqual({ servicio });
        expect(serviciosRepositorio.actualizarServicio).toHaveBeenCalledWith(
            1, { duracion: 45, activo: true }, 1, 5
        );
    });

    test('4. Registrar profesional correctamente', async () => {
        const datos = {
            usuarioId: 10,
            licencia: 'MED-123',
            especialidades: [1, 2]
        };

        const profesional = { professionalId: 1, licencia: 'MED-123' };

        profesionalesRepositorio.registrarProfesional.mockResolvedValue(profesional);

        const resultado = await profesionalesService.registrarProfesional(
            datos, 1, 5
        );

        expect(resultado).toEqual({ profesional });
        expect(profesionalesRepositorio.registrarProfesional).toHaveBeenCalledWith(
            datos, 1, 5
        );
    });

    test('5. Rechazar registro de profesional inválido', async () => {
        const resultado = await profesionalesService.registrarProfesional({
            usuarioId: 10,
            licencia: 'MED-123',
            especialidades: [1, 1]
        }, 1, 5);

        expect(resultado).toEqual({
            error: 'Las especialidades deben ser IDs válidos y sin duplicados.',
            status: 400
        });

        expect(profesionalesRepositorio.registrarProfesional).not.toHaveBeenCalled();
    });

    test('6. Asociar servicio a profesional', async () => {
        const respuesta = { asociado: true };

        profesionalesRepositorio.asociarServicio.mockResolvedValue(respuesta);

        const resultado = await profesionalesService.asociarServicio(
            '1', '2', 1, 5
        );

        expect(resultado).toEqual({ resultado: respuesta });
        expect(profesionalesRepositorio.asociarServicio).toHaveBeenCalledWith(
            1, 2, 1, 5
        );
    });
});
