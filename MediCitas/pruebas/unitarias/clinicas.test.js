
jest.mock('../../services/admin-plataforma/src/repositorios/clinicas_repos', () => ({
    crearClinica: jest.fn(),
    obtenerClinicas: jest.fn()
}));

const clinicasService = require('../../services/admin-plataforma/src/servicios/clinicas_servicio');
const clinicasRepositorio = require('../../services/admin-plataforma/src/repositorios/clinicas_repos');

describe('Pruebas unitarias del servicio de clínicas', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const datosValidos = {
        nombre: ' Clínica Central ',
        adminProviderId: ' admin-central ',
        adminIdentificacion: '123456789',
        adminNombre: ' Ana ',
        adminApellido: ' Solís ',
        adminEmail: ' ana@test.com '
    };

    test('1. Crear clínica correctamente', async () => {
        const clinica = { clinicId: 1, nombre: 'Clínica Central' };

        clinicasRepositorio.crearClinica.mockResolvedValue(clinica);

        const resultado = await clinicasService.crearClinica(datosValidos, 5);

        expect(resultado).toEqual({ clinica });

        expect(clinicasRepositorio.crearClinica).toHaveBeenCalledWith(
            {
                nombre: 'Clínica Central',
                zonaHoraria: 'America/Costa_Rica',
                adminProviderId: 'admin-central',
                adminIdentificacion: '123456789',
                adminNombre: 'Ana',
                adminApellido: 'Solís',
                adminEmail: 'ana@test.com',
                adminTelefono: null
            },
            5
        );
    });

    test('2. Rechazar creación con datos inválidos', async () => {
        const resultado = await clinicasService.crearClinica(
            { ...datosValidos, nombre: ' ' },
            5
        );

        expect(resultado).toEqual({
            error: 'El nombre de la clínica es obligatorio y debe tener máximo 100 caracteres.',
            status: 400
        });

        expect(clinicasRepositorio.crearClinica).not.toHaveBeenCalled();
    });

    test('3. Obtener clínicas correctamente', async () => {
        const clinicas = [
            { clinicId: 1, nombre: 'Clínica Central' },
            { clinicId: 2, nombre: 'Clínica Este' }
        ];

        clinicasRepositorio.obtenerClinicas.mockResolvedValue(clinicas);

        const resultado = await clinicasService.obtenerClinicas();

        expect(resultado).toEqual({ clinicas });
        expect(clinicasRepositorio.obtenerClinicas).toHaveBeenCalledTimes(1);
    });
});
