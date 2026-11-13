jest.mock('../../services/admin-clinica/src/repositorios/horarios_repos', () => ({
    crearHorario: jest.fn()
}));

jest.mock('../../services/admin-clinica/src/repositorios/bloqueos_repos', () => ({
    crearBloqueo: jest.fn()
}));

jest.mock('../../services/recepcion/src/repositorios/disponibilidad_repos', () => ({
    consultarDisponibilidadProfesional: jest.fn(),
    consultarDisponibilidadServicio: jest.fn()
}));

// Dependencia simulada: no estamos probando Redis.
jest.mock('../../services/admin-clinica/src/config/redis', () => ({
    deleteKeysByPattern: jest.fn()
}));

jest.mock('../../services/recepcion/src/config/redis', () => ({
    getCache: jest.fn(),
    setCache: jest.fn()
}));

const horariosRepositorio = require('../../services/admin-clinica/src/repositorios/horarios_repos');
const bloqueosRepositorio = require('../../services/admin-clinica/src/repositorios/bloqueos_repos');
const disponibilidadRepositorio = require('../../services/recepcion/src/repositorios/disponibilidad_repos');

const horariosServicio = require('../../services/admin-clinica/src/servicios/horarios_servicio');
const bloqueosServicio = require('../../services/admin-clinica/src/servicios/bloqueos_servicio');
const disponibilidadServicio = require('../../services/recepcion/src/servicios/disponibilidad_servicio');

describe('Pruebas unitarias de agenda', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // 1. Crear horario correctamente
    test('Debe crear un horario cuando los datos son válidos', async () => {
        const datos = {
            profesionalId: 1,
            dia: 1,
            horaInicio: '08:00',
            horaFin: '12:00'
        };

        const horarioCreado = {
            horarioId: 1,
            ...datos
        };

        horariosRepositorio.crearHorario.mockResolvedValue(horarioCreado);

        const resultado = await horariosServicio.crearHorario(datos, 1, 5);

        expect(resultado).toEqual({
            horario: horarioCreado
        });

        expect(horariosRepositorio.crearHorario).toHaveBeenCalledWith(
            datos,
            1,
            5
        );
    });

    // 2. Rechazar horario inválido
    test('Debe rechazar un horario cuya hora final sea anterior a la inicial', async () => {
        const datos = {
            profesionalId: 1,
            dia: 1,
            horaInicio: '13:00',
            horaFin: '12:00'
        };

        const resultado = await horariosServicio.crearHorario(datos, 1, 5);

        expect(resultado).toEqual({
            error: 'La hora de finalización debe ser posterior a la hora de inicio.',
            status: 400
        });

        expect(horariosRepositorio.crearHorario).not.toHaveBeenCalled();
    });

    // 3. Crear bloqueo correctamente
    test('Debe crear un bloqueo cuando los datos son válidos', async () => {
        const datos = {
            profesionalId: 1,
            fechaInicio: '2026-11-20T09:00:00-06:00',
            fechaFin: '2026-11-20T10:00:00-06:00',
            motivo: '  Vacaciones  '
        };

        const bloqueoCreado = {
            bloqueoId: 1,
            profesionalId: 1,
            fechaInicio: datos.fechaInicio,
            fechaFin: datos.fechaFin,
            motivo: 'Vacaciones'
        };

        bloqueosRepositorio.crearBloqueo.mockResolvedValue(bloqueoCreado);

        const resultado = await bloqueosServicio.crearBloqueo(datos, 1, 5);

        expect(resultado).toEqual({
            bloqueo: bloqueoCreado
        });

        expect(bloqueosRepositorio.crearBloqueo).toHaveBeenCalledWith(
            {
                ...datos,
                motivo: 'Vacaciones'
            },
            1,
            5
        );
    });

    // 4. Rechazar bloqueo inválido
    test('Debe rechazar un bloqueo cuya fecha final sea anterior a la inicial', async () => {
        const datos = {
            profesionalId: 1,
            fechaInicio: '2026-11-20T10:00:00-06:00',
            fechaFin: '2026-11-20T09:00:00-06:00',
            motivo: 'Cita personal'
        };

        const resultado = await bloqueosServicio.crearBloqueo(datos, 1, 5);

        expect(resultado).toEqual({
            error: 'La fecha de finalización debe ser posterior a la fecha de inicio.',
            status: 400
        });

        expect(bloqueosRepositorio.crearBloqueo).not.toHaveBeenCalled();
    });

    // 5. Consultar disponibilidad de un profesional
    test('Debe consultar la disponibilidad de un profesional', async () => {
        const espacios = [
            {
                horaInicio: '08:00',
                horaFin: '08:30'
            },
            {
                horaInicio: '08:30',
                horaFin: '09:00'
            }
        ];

        disponibilidadRepositorio.consultarDisponibilidadProfesional
            .mockResolvedValue(espacios);

        const resultado = await disponibilidadServicio
            .consultarDisponibilidadProfesional(
                1,
                5,
                '10',
                '2026-11-20',
                'profesional de salud'
            );

        expect(resultado).toEqual({
            espacios,
            origen: 'db'
        });

        expect(
            disponibilidadRepositorio.consultarDisponibilidadProfesional
        ).toHaveBeenCalledWith(
            1,
            5,
            10,
            '2026-11-20'
        );
    });

    // 6. Consultar disponibilidad por servicio
    test('Debe consultar la disponibilidad de un servicio en un rango de fechas', async () => {
        const disponibilidad = [
            {
                fecha: '2026-11-20',
                espaciosDisponibles: 5
            },
            {
                fecha: '2026-11-21',
                espaciosDisponibles: 3
            }
        ];

        disponibilidadRepositorio.consultarDisponibilidadServicio
            .mockResolvedValue(disponibilidad);

        const resultado = await disponibilidadServicio
            .consultarDisponibilidadServicio(
                1,
                5,
                '3',
                '2026-11-20',
                '2026-11-21'
            );

        expect(resultado).toEqual({
            disponibilidad
        });

        expect(
            disponibilidadRepositorio.consultarDisponibilidadServicio
        ).toHaveBeenCalledWith(
            1,
            5,
            3,
            '2026-11-20',
            '2026-11-21'
        );
    });
});
