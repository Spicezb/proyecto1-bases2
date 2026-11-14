const request = require('supertest');
const { execFileSync } = require('child_process');
const path = require('path');
const { obtenerToken } = require('../helpers/auth');

const API_URL = process.env.TEST_API_URL;
const ROOT_DIR = path.resolve(__dirname, '../..');

// Estos clinicpatientid provienen del seeding de la base inicial.
const CLINIC_PATIENT_CENTRAL_A = 3;
const CLINIC_PATIENT_CENTRAL_B = 6;
const CLINIC_PATIENT_EAST = 1;

let tokenRecepcion;
let tokenProfesional;
let profesionalMaria;
let profesionalCarlos;
let servicioGeneral;
let servicioPediatrico;

function fechaLaboralFutura(dias = 7) {
    const fecha = new Date();
    fecha.setUTCHours(12, 0, 0, 0);
    fecha.setUTCDate(fecha.getUTCDate() + dias);

    while ([0, 6].includes(fecha.getUTCDay())) {
        fecha.setUTCDate(fecha.getUTCDate() + 1);
    }

    return fecha.toISOString().slice(0, 10);
}

function fechaHoraLocalCR(fecha, hora) {
    return `${fecha}T${hora}-06:00`;
}

async function consultarDisponibilidad(profesionalId, fecha) {
    const response = await request(API_URL)
        .get('/api/disponibilidad/profesional')
        .query({ profesionalId, fecha })
        .set('Authorization', `Bearer ${tokenRecepcion}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    return response.body;
}

async function consultarAgenda(fecha, profesionalId) {
    const response = await request(API_URL)
        .get('/api/citas/agenda')
        .query({ fecha, profesionalId })
        .set('Authorization', `Bearer ${tokenRecepcion}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    return response.body;
}

async function reservar({ pacienteId, profesionalId, servicioId, fechaHora }) {
    return request(API_URL)
        .post('/api/citas')
        .set('Authorization', `Bearer ${tokenRecepcion}`)
        .send({ pacienteId, profesionalId, servicioId, fechaHora });
}

function buscarEspacio(espacios, duracionMinutos) {
    return espacios.find(espacio =>
        new Date(espacio.fin).getTime() - new Date(espacio.inicio).getTime()
            >= duracionMinutos * 60000
    );
}

function buscarInicioComun(espaciosA, espaciosB, duracionMinutos) {
    for (const a of espaciosA) {
        for (const b of espaciosB) {
            const inicio = Math.max(
                new Date(a.inicio).getTime(),
                new Date(b.inicio).getTime()
            );

            const fin = Math.min(
                new Date(a.fin).getTime(),
                new Date(b.fin).getTime()
            );

            if (fin - inicio >= duracionMinutos * 60000) {
                return {
                    inicio: new Date(inicio).toISOString(),
                    fin: new Date(fin).toISOString()
                };
            }
        }
    }

    return undefined;
}

beforeAll(async () => {
    if (
        !API_URL ||
        !process.env.TEST_RECEPCION_USERNAME ||
        !process.env.TEST_RECEPCION_PASSWORD ||
        !process.env.TEST_PROFESIONAL_USERNAME ||
        !process.env.TEST_PROFESIONAL_PASSWORD
    ) {
        throw new Error('Faltan TEST_API_URL o credenciales TEST_RECEPCION_*/TEST_PROFESIONAL_* en pruebas/.env.test.');
    }

    [tokenRecepcion, tokenProfesional] = await Promise.all([
        obtenerToken(process.env.TEST_RECEPCION_USERNAME, process.env.TEST_RECEPCION_PASSWORD),
        obtenerToken(process.env.TEST_PROFESIONAL_USERNAME, process.env.TEST_PROFESIONAL_PASSWORD)
    ]);

    // IDs de relación obtenidos desde las rutas existentes; no se asumen IDs seriales.
    const profesionalesResponse = await request(API_URL)
        .get('/api/profesionales')
        .set('Authorization', `Bearer ${tokenRecepcion}`);

    expect(profesionalesResponse.status).toBe(200);
    expect(Array.isArray(profesionalesResponse.body)).toBe(true);

    profesionalMaria = profesionalesResponse.body.find(p => p.licencia === 'med-cr-001');
    profesionalCarlos = profesionalesResponse.body.find(p => p.licencia === 'med-cr-002');
    expect(profesionalMaria).toBeDefined();
    expect(profesionalCarlos).toBeDefined();

    const serviciosResponse = await request(API_URL)
        .get('/api/servicios')
        .set('Authorization', `Bearer ${tokenRecepcion}`);

    expect(serviciosResponse.status).toBe(200);
    expect(Array.isArray(serviciosResponse.body)).toBe(true);

    servicioGeneral = serviciosResponse.body.find(s => s.nombre === 'consulta general');
    servicioPediatrico = serviciosResponse.body.find(s => s.nombre === 'consulta pediátrica');
    expect(servicioGeneral).toBeDefined();
    expect(servicioPediatrico).toBeDefined();

    // Confirmar las asociaciones mediante la ruta existente, antes de probar reservas.
    const [serviciosMaria, serviciosCarlos] = await Promise.all([
        request(API_URL)
            .get(`/api/profesionales/${profesionalMaria.id}/servicios`)
            .set('Authorization', `Bearer ${tokenRecepcion}`),
        request(API_URL)
            .get(`/api/profesionales/${profesionalCarlos.id}/servicios`)
            .set('Authorization', `Bearer ${tokenRecepcion}`)
    ]);

    expect(serviciosMaria.status).toBe(200);
    expect(serviciosCarlos.status).toBe(200);
    expect(
    serviciosMaria.body.some(s => s.servicioId === servicioGeneral.id)
    ).toBe(true);

    expect(
    serviciosCarlos.body.some(s => s.servicioId === servicioPediatrico.id)
    ).toBe(true);
});

describe('Pruebas de integración - Invariantes de MediCitas', () => {
    test('I1: un profesional no puede tener dos citas vigentes con intervalos solapados', async () => {
        const fecha = fechaLaboralFutura(7);
        const espacios = await consultarDisponibilidad(profesionalMaria.id, fecha);
        const espacio = buscarEspacio(espacios, servicioGeneral.duracion);
        expect(espacio).toBeDefined();

        const fechaHora = new Date(espacio.inicio).toISOString();
        const resultados = await Promise.all([
            reservar({
                pacienteId: CLINIC_PATIENT_CENTRAL_A,
                profesionalId: profesionalMaria.id,
                servicioId: servicioGeneral.id,
                fechaHora
            }),
            reservar({
                pacienteId: CLINIC_PATIENT_CENTRAL_B,
                profesionalId: profesionalMaria.id,
                servicioId: servicioGeneral.id,
                fechaHora
            })
        ]);

        expect(resultados.map(r => r.status).sort()).toEqual([201, 409]);
    });

    test('I2: un paciente no puede tener dos citas solapadas con profesionales distintos', async () => {
        const fecha = fechaLaboralFutura(14);
        const [espaciosMaria, espaciosCarlos] = await Promise.all([
            consultarDisponibilidad(profesionalMaria.id, fecha),
            consultarDisponibilidad(profesionalCarlos.id, fecha)
        ]);

        const espacioComun = buscarInicioComun(
            espaciosMaria,
            espaciosCarlos,
            servicioPediatrico.duracion
        );
        expect(espacioComun).toBeDefined();

        const fechaHora = new Date(espacioComun.inicio).toISOString();
        const primera = await reservar({
            pacienteId: CLINIC_PATIENT_CENTRAL_A,
            profesionalId: profesionalMaria.id,
            servicioId: servicioGeneral.id,
            fechaHora
        });
        expect(primera.status).toBe(201);

        const segunda = await reservar({
            pacienteId: CLINIC_PATIENT_CENTRAL_A,
            profesionalId: profesionalCarlos.id,
            servicioId: servicioPediatrico.id,
            fechaHora
        });
        expect(segunda.status).toBe(409);
    });

    test('I3: las citas respetan los horarios y bloqueos del profesional', async () => {

    // 1. Verificar que no se permita reservar fuera del horario.
    const fechaFueraHorario = fechaLaboralFutura(21);

    const fueraHorario = await reservar({
        pacienteId: CLINIC_PATIENT_CENTRAL_A,
        profesionalId: profesionalMaria.id,
        servicioId: servicioGeneral.id,
        fechaHora: fechaHoraLocalCR(fechaFueraHorario, '23:30:00')
    });

    expect(fueraHorario.status).toBe(409);

    // 2. Buscar un espacio libre para crear un bloqueo sin colisiones.
    const fechaBloqueo = fechaLaboralFutura(60);

    const espacios = await consultarDisponibilidad(
        profesionalMaria.id,
        fechaBloqueo
    );

    const espacio = buscarEspacio(espacios, 30);

    expect(espacio).toBeDefined();

    const inicioBloqueo = new Date(espacio.inicio);
    inicioBloqueo.setMinutes(inicioBloqueo.getMinutes() + 1);

    const finBloqueo = new Date(inicioBloqueo);
    finBloqueo.setMinutes(finBloqueo.getMinutes() + 30);

    const fechaInicio = inicioBloqueo.toISOString();
    const fechaFin = finBloqueo.toISOString();

    // 3. Crear el bloqueo mediante la ruta existente.
    const crearBloqueo = await request(API_URL)
        .post('/api/bloqueos')
        .set('Authorization', `Bearer ${tokenProfesional}`)
        .send({
            profesionalId: profesionalMaria.id,
            fechaInicio,
            fechaFin,
            motivo: 'Prueba de integración I3'
        });

    expect(crearBloqueo.status).toBe(201);

    // 4. Intentar reservar dentro del bloqueo.
    const duranteBloqueo = await reservar({
        pacienteId: CLINIC_PATIENT_CENTRAL_A,
        profesionalId: profesionalMaria.id,
        servicioId: servicioGeneral.id,
        fechaHora: new Date(
            inicioBloqueo.getTime() + 60000
        ).toISOString()
    });

    expect(duranteBloqueo.status).toBe(409);
    });

    test('I4: la duración de la cita corresponde a la duración configurada para el servicio', async () => {
        const fecha = fechaLaboralFutura(35);
        const espacios = await consultarDisponibilidad(profesionalMaria.id, fecha);
        const espacio = buscarEspacio(espacios, servicioGeneral.duracion);
        expect(espacio).toBeDefined();

        const fechaHora = new Date(espacio.inicio).toISOString();
        const reserva = await reservar({
            pacienteId: CLINIC_PATIENT_CENTRAL_A,
            profesionalId: profesionalMaria.id,
            servicioId: servicioGeneral.id,
            fechaHora
        });
        expect(reserva.status).toBe(201);

        const agenda = await consultarAgenda(fecha, profesionalMaria.id);
        const cita = agenda.find(item =>
            new Date(item.fechaHoraInicio).getTime() === new Date(fechaHora).getTime()
        );
        expect(cita).toBeDefined();

        const duracionReal = (
            new Date(cita.fechaHoraFin).getTime() -
            new Date(cita.fechaHoraInicio).getTime()
        ) / 60000;
        expect(duracionReal).toBe(servicioGeneral.duracion);
    });

    test('I5: un usuario de Clínica Central no puede consultar un paciente de Clínica del Este', async () => {
        const propio = await request(API_URL)
            .get(`/api/pacientes/${CLINIC_PATIENT_CENTRAL_A}`)
            .set('Authorization', `Bearer ${tokenRecepcion}`);
        expect(propio.status).toBe(200);

        const ajeno = await request(API_URL)
            .get(`/api/pacientes/${CLINIC_PATIENT_EAST}`)
            .set('Authorization', `Bearer ${tokenRecepcion}`);
        expect(ajeno.status).toBe(404);
    });

    test('I6: PostgreSQL impide que recepción modifique o elimine registros de auditoría', () => {
        const operaciones = [
            'UPDATE public.auditlogs SET auditresultid = auditresultid WHERE false;',
            'DELETE FROM public.auditlogs WHERE false;'
        ];

        for (const sql of operaciones) {
            let error;
            try {
                execFileSync(
                    'docker',
                    [
                        'compose', 'exec', '-T', 'postgres', 'sh', '-lc',
                        `PGPASSWORD="$RECEPCION_PASSWORD" psql -h localhost -U "$RECEPCION_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "${sql}"`
                    ],
                    {
                        cwd: ROOT_DIR,
                        encoding: 'utf8',
                        env: process.env,
                        stdio: ['ignore', 'pipe', 'pipe']
                    }
                );
            } catch (err) {
                error = err;
            }

            expect(error).toBeDefined();
            expect(String(error.stderr)).toMatch(/permission denied|insufficient privilege/i);
        }
    });

    test('I7: cancelar una cita libera el espacio para una nueva consulta de disponibilidad', async () => {
        const fecha = fechaLaboralFutura(42);
        const espacios = await consultarDisponibilidad(profesionalMaria.id, fecha);
        const espacio = buscarEspacio(espacios, servicioGeneral.duracion);
        expect(espacio).toBeDefined();

        const fechaHora = new Date(espacio.inicio).toISOString();
        const reserva = await reservar({
            pacienteId: CLINIC_PATIENT_CENTRAL_A,
            profesionalId: profesionalMaria.id,
            servicioId: servicioGeneral.id,
            fechaHora
        });
        expect(reserva.status).toBe(201);

        const agenda = await consultarAgenda(fecha, profesionalMaria.id);
        const cita = agenda.find(item =>
        new Date(item.fechaHoraInicio).getTime() === new Date(fechaHora).getTime() &&
        item.pacienteId === CLINIC_PATIENT_CENTRAL_A &&
        item.estadoId === 1
        );

        expect(cita).toBeDefined();

        const cancelacion = await request(API_URL)
            .put(`/api/citas/${cita.citaId}/cancelar`)
            .set('Authorization', `Bearer ${tokenRecepcion}`)
            .send({ motivo: 'Prueba automatizada del invariante I7' });
        expect(cancelacion.status).toBe(200);

        const disponibilidadPosterior = await consultarDisponibilidad(profesionalMaria.id, fecha);
        const espacioLiberado = disponibilidadPosterior.some(slot =>
            new Date(slot.inicio).getTime() <= new Date(fechaHora).getTime() &&
            new Date(slot.fin).getTime() > new Date(fechaHora).getTime()
        );
        expect(espacioLiberado).toBe(true);
    });

    test('I8: reservar una cita invalida la caché y el espacio deja de aparecer disponible', async () => {
        const fecha = fechaLaboralFutura(49);
        const espaciosAntes = await consultarDisponibilidad(profesionalMaria.id, fecha);
        const espacio = buscarEspacio(espaciosAntes, servicioGeneral.duracion);
        expect(espacio).toBeDefined();

        const fechaHora = new Date(espacio.inicio).toISOString();
        const reserva = await reservar({
            pacienteId: CLINIC_PATIENT_CENTRAL_A,
            profesionalId: profesionalMaria.id,
            servicioId: servicioGeneral.id,
            fechaHora
        });
        expect(reserva.status).toBe(201);

        const espaciosDespues = await consultarDisponibilidad(profesionalMaria.id, fecha);
        const sigueDisponible = espaciosDespues.some(slot =>
            new Date(slot.inicio).getTime() <= new Date(fechaHora).getTime() &&
            new Date(slot.fin).getTime() > new Date(fechaHora).getTime()
        );
        expect(sigueDisponible).toBe(false);
    });
});