
const request = require('supertest');
const { obtenerToken } = require('../helpers/auth');

const API_URL = process.env.TEST_API_URL;

let tokenRecepcion;
let tokenAdminClinica;
let profesional;
let servicio;
let pacientes;

function fechaLaboralFutura(dias = 90) {
    const fecha = new Date();
    fecha.setUTCHours(12, 0, 0, 0);
    fecha.setUTCDate(fecha.getUTCDate() + dias);

    while ([0, 6].includes(fecha.getUTCDay())) {
        fecha.setUTCDate(fecha.getUTCDate() + 1);
    }

    return fecha.toISOString().slice(0, 10);
}

beforeAll(async () => {
    if (!API_URL) {
        throw new Error('Falta TEST_API_URL en pruebas/.env.test.');
    }

    [tokenRecepcion, tokenAdminClinica] = await Promise.all([
        obtenerToken(
            process.env.TEST_RECEPCION_USERNAME,
            process.env.TEST_RECEPCION_PASSWORD
        ),
        obtenerToken(
            process.env.TEST_ADMIN_CLINICA_USERNAME,
            process.env.TEST_ADMIN_CLINICA_PASSWORD
        )
    ]);

    const [profesionalesResponse, serviciosResponse, pacientesResponse] =
        await Promise.all([
            request(API_URL)
                .get('/api/profesionales')
                .set('Authorization', `Bearer ${tokenRecepcion}`),

            request(API_URL)
                .get('/api/servicios')
                .set('Authorization', `Bearer ${tokenRecepcion}`),

            request(API_URL)
                .get('/api/pacientes')
                .set('Authorization', `Bearer ${tokenRecepcion}`)
        ]);

    expect(profesionalesResponse.status).toBe(200);
    expect(serviciosResponse.status).toBe(200);
    expect(pacientesResponse.status).toBe(200);

    profesional = profesionalesResponse.body.find(
        p => p.licencia === 'med-cr-001'
    );

    servicio = serviciosResponse.body.find(
        s => s.nombre === 'consulta general'
    );

    pacientes = pacientesResponse.body
        .filter(p => Number.isInteger(p.clinicpatientid))
        .slice(0, 2);

    expect(profesional).toBeDefined();
    expect(servicio).toBeDefined();
    expect(pacientes).toHaveLength(2);
    expect(pacientes[0].clinicpatientid)
        .not.toBe(pacientes[1].clinicpatientid);
});

describe('Prueba de concurrencia - MediCitas', () => {

    test('dos clientes compiten por el mismo espacio y solamente uno consigue reservarlo', async () => {
        const fecha = fechaLaboralFutura(90);

        // Consultar disponibilidad antes de iniciar la carrera.
        const disponibilidad = await request(API_URL)
            .get('/api/disponibilidad/profesional')
            .query({
                profesionalId: profesional.id,
                fecha
            })
            .set('Authorization', `Bearer ${tokenRecepcion}`);

        expect(disponibilidad.status).toBe(200);
        expect(Array.isArray(disponibilidad.body)).toBe(true);

        const espacio = disponibilidad.body.find(slot =>
            new Date(slot.fin).getTime() -
            new Date(slot.inicio).getTime() >=
            Number(servicio.duracion) * 60000
        );

        expect(espacio).toBeDefined();

        const fechaHora = new Date(espacio.inicio).toISOString();

        // Dos usuarios distintos compiten simultáneamente por el mismo espacio.
        const respuestas = await Promise.all([
            request(API_URL)
                .post('/api/citas')
                .set('Authorization', `Bearer ${tokenRecepcion}`)
                .send({
                    pacienteId: pacientes[0].clinicpatientid,
                    profesionalId: profesional.id,
                    servicioId: servicio.id,
                    fechaHora
                }),

            request(API_URL)
                .post('/api/citas')
                .set('Authorization', `Bearer ${tokenAdminClinica}`)
                .send({
                    pacienteId: pacientes[1].clinicpatientid,
                    profesionalId: profesional.id,
                    servicioId: servicio.id,
                    fechaHora
                })
        ]);

        const estados = respuestas
            .map(respuesta => respuesta.status)
            .sort((a, b) => a - b);

        // Exactamente una reserva concedida y una rechazada por conflicto.
        expect(estados).toEqual([201, 409]);

        expect(
            respuestas.filter(respuesta => respuesta.status === 201)
        ).toHaveLength(1);

        expect(
            respuestas.filter(respuesta => respuesta.status === 409)
        ).toHaveLength(1);

        // Comprobar que la base refleja una sola cita en ese espacio.
        const agenda = await request(API_URL)
            .get('/api/citas/agenda')
            .query({
                fecha,
                profesionalId: profesional.id
            })
            .set('Authorization', `Bearer ${tokenRecepcion}`);

        expect(agenda.status).toBe(200);

        const citasEnElEspacio = agenda.body.filter(cita =>
            new Date(cita.fechaHoraInicio).getTime() ===
            new Date(fechaHora).getTime()
        );

        expect(citasEnElEspacio).toHaveLength(1);
    });
});
