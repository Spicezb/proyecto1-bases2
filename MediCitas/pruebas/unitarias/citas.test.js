
jest.mock('../../services/recepcion/src/repositorios/citas_repos', () => ({
    reservarCita: jest.fn(),
    reprogramarCita: jest.fn(),
    cancelarCita: jest.fn(),
    registrarDesenlace: jest.fn(),
    consultarAgenda: jest.fn(),
    consultarCitasPaciente: jest.fn(),
    contarCitasPorEstado: jest.fn()
}));

// Simular Redis: no estamos probando la caché.
jest.mock('../../services/recepcion/src/config/redis', () => ({
    deleteCache: jest.fn().mockResolvedValue(undefined)
}));

// Simular la función auxiliar utilizada para construir claves.
jest.mock('../../services/recepcion/src/servicios/disponibilidad_servicio', () => ({
    construirClaveDisponibilidad: jest.fn(
        (clinicId, profesionalId, fecha) =>
            `medicitas:disp:${clinicId}:prof:${profesionalId}:date:${fecha}`
    )
}));

const citasRepositorio = require('../../services/recepcion/src/repositorios/citas_repos');
const citasServicio = require('../../services/recepcion/src/servicios/citas_servicio');

describe('Pruebas unitarias de citas', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // 1. Reservar una cita correctamente
    test('Debe reservar una cita cuando los datos son válidos', async () => {
        const datos = {
            pacienteId: 1,
            profesionalId: 2,
            servicioId: 3,
            fechaHora: '2026-11-20T09:00:00-06:00'
        };

        const citaCreada = {
            ...datos,
            estado: 'reservada'
        };

        citasRepositorio.reservarCita.mockResolvedValue(citaCreada);

        const resultado = await citasServicio.reservarCita(datos, 1, 5);

        expect(resultado).toEqual({
            cita: citaCreada
        });

        expect(citasRepositorio.reservarCita).toHaveBeenCalledWith(
            datos,
            1,
            5
        );
    });

    // 2. Rechazar una reserva con datos inválidos
    test('Debe rechazar una reserva cuando el ID del paciente no es válido', async () => {
        const datos = {
            pacienteId: 0,
            profesionalId: 2,
            servicioId: 3,
            fechaHora: '2026-11-20T09:00:00-06:00'
        };

        const resultado = await citasServicio.reservarCita(datos, 1, 5);

        expect(resultado).toEqual({
            error: 'El ID del paciente debe ser un entero positivo.',
            status: 400
        });

        expect(citasRepositorio.reservarCita).not.toHaveBeenCalled();
    });

    // 3. Reprogramar una cita correctamente
    test('Debe reprogramar una cita cuando los datos son válidos', async () => {
        const datos = {
            nuevoProfesionalId: 4,
            nuevoServicioId: 3,
            nuevaFechaHora: '2026-11-21T10:00:00-06:00'
        };

        const citaReprogramada = {
            citaOriginalId: 10,
            ...datos,
            profesionalOriginalId: null,
            fechaOriginal: null,
            estado: 'reprogramada'
        };

        citasRepositorio.reprogramarCita.mockResolvedValue(citaReprogramada);

        const resultado = await citasServicio.reprogramarCita(
            '10',
            datos,
            1,
            5
        );

        expect(resultado).toEqual({
            cita: citaReprogramada
        });

        expect(citasRepositorio.reprogramarCita).toHaveBeenCalledWith(
            10,
            datos,
            1,
            5
        );
    });

    // 4. Cancelar una cita correctamente
    test('Debe cancelar una cita y utilizar el motivo predeterminado cuando no se proporciona uno', async () => {
        const citaCancelada = {
            citaId: 10,
            estado: 'cancelada',
            motivo: 'Cancelada por recepción'
        };

        citasRepositorio.cancelarCita.mockResolvedValue(citaCancelada);

        const resultado = await citasServicio.cancelarCita(
            '10',
            undefined,
            1,
            5
        );

        expect(resultado).toEqual({
            cita: citaCancelada
        });

        expect(citasRepositorio.cancelarCita).toHaveBeenCalledWith(
            10,
            'Cancelada por recepción',
            1,
            5
        );
    });

    // 5. Registrar el desenlace de una cita
    test('Debe registrar una cita como atendida', async () => {
        const citaActualizada = {
            citaId: 10,
            estadoId: 2,
            estado: 'atendida'
        };

        citasRepositorio.registrarDesenlace.mockResolvedValue(citaActualizada);

        const resultado = await citasServicio.registrarDesenlace(
            '10',
            'atendida',
            1,
            5
        );

        expect(resultado).toEqual({
            cita: citaActualizada
        });

        expect(citasRepositorio.registrarDesenlace).toHaveBeenCalledWith(
            10,
            2,
            1,
            5
        );
    });

    // 6. Consultar la agenda de la clínica
    test('Debe consultar la agenda de una clínica para una fecha determinada', async () => {
        const agenda = [
            {
                citaId: 10,
                pacienteNombre: 'Paciente 1',
                profesionalNombre: 'Profesional 1',
                servicioNombre: 'Consulta general'
            }
        ];

        citasRepositorio.consultarAgenda.mockResolvedValue(agenda);

        const resultado = await citasServicio.consultarAgenda(
            1,
            5,
            '2026-11-20'
        );

        expect(resultado).toEqual({
            agenda
        });

        expect(citasRepositorio.consultarAgenda).toHaveBeenCalledWith(
            1,
            5,
            '2026-11-20',
            null
        );
    });

    // 7. Consultar el historial de citas de un paciente
    test('Debe consultar el historial de citas de un paciente', async () => {
        const citas = [
            {
                citaId: 10,
                estadoId: 2,
                servicioNombre: 'Consulta general'
            },
            {
                citaId: 11,
                estadoId: 4,
                servicioNombre: 'Odontología'
            }
        ];

        citasRepositorio.consultarCitasPaciente.mockResolvedValue(citas);

        const resultado = await citasServicio.consultarCitasPaciente(
            1,
            5,
            '20'
        );

        expect(resultado).toEqual({
            citas
        });

        expect(citasRepositorio.consultarCitasPaciente).toHaveBeenCalledWith(
            1,
            5,
            20
        );
    });

    // 8. Contar citas por estado
    test('Debe contar las citas por estado dentro de un rango de fechas', async () => {
        const resumen = [
            { estadoId: 1, total: 5 },
            { estadoId: 2, total: 12 },
            { estadoId: 3, total: 2 },
            { estadoId: 4, total: 1 }
        ];

        citasRepositorio.contarCitasPorEstado.mockResolvedValue(resumen);

        const resultado = await citasServicio.contarCitasPorEstado(
            1,
            5,
            '2026-11-01',
            '2026-11-30'
        );

        expect(resultado).toEqual({
            resumen
        });

        expect(citasRepositorio.contarCitasPorEstado).toHaveBeenCalledWith(
            1,
            5,
            '2026-11-01',
            '2026-11-30'
        );
    });
});
