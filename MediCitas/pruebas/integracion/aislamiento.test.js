const request = require('supertest');
const { execFileSync } = require('child_process');
const path = require('path');
const { obtenerToken } = require('../helpers/auth');

const API_URL = process.env.TEST_API_URL;
const ROOT_DIR = path.resolve(__dirname, '../..');
const DB_USER = process.env.DB_USER || 'medicitas_user';
const DB_NAME = process.env.DB_NAME || 'medicitas';

let tokenCentral;
let clinicCentral;
let clinicEste;
let pacienteCentral;
let pacienteEste;

// Ejecuta SQL dentro del contenedor PostgreSQL.
function ejecutarSQL(sql) {
    const resultado = execFileSync(
        'docker',
        [
            'compose', 'exec', '-T', 'postgres',
            'psql', '-X', '-U', DB_USER, '-d', DB_NAME,
            '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-F', '|', '-c', sql
        ],
        {
            cwd: ROOT_DIR,
            encoding: 'utf8',
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe']
        }
    );

    return resultado
        .split('\n')
        .map(linea => linea.trim())
        .filter(linea => linea && linea !== 'SET')
        .join('\n');
}

function obtenerTiempoPlan(jsonPlan) {
    const inicio = jsonPlan.indexOf('[');

    if (inicio === -1) {
        throw new Error(`No se encontró el JSON: ${jsonPlan}`);
    }

    const plan = JSON.parse(jsonPlan.substring(inicio));

    return plan[0]['Execution Time'];
}

// Consulta utilizando el filtro explícito de clínica.
const consultaNormal = (clinicId) => `
    EXPLAIN (ANALYZE, FORMAT JSON)
    SELECT cp.clinicpatientid, cp.clinicid
    FROM public.clinicpatients cp
    JOIN public.patients p ON p.patientid = cp.patientid
    WHERE cp.clinicid = ${Number(clinicId)}
      AND cp.isactive = TRUE
      AND p.isactive = TRUE
    ORDER BY cp.clinicpatientid;
`;

// Consulta equivalente utilizando RLS.
const consultaRLS = (clinicId) => `
    SET ROLE rol_security;
    SET app.clinic_id = '${Number(clinicId)}';

    EXPLAIN (ANALYZE, FORMAT JSON)
    SELECT cp.clinicpatientid, cp.clinicid
    FROM public.clinicpatients cp
    JOIN public.patients p ON p.patientid = cp.patientid
    WHERE cp.isactive = TRUE
      AND p.isactive = TRUE
    ORDER BY cp.clinicpatientid;
`;

beforeAll(async () => {
    if (
        !API_URL ||
        !process.env.TEST_RECEPCION_USERNAME ||
        !process.env.TEST_RECEPCION_PASSWORD
    ) {
        throw new Error(
            'Faltan TEST_API_URL o credenciales TEST_RECEPCION_* en pruebas/.env.test.'
        );
    }

    tokenCentral = await obtenerToken(
        process.env.TEST_RECEPCION_USERNAME,
        process.env.TEST_RECEPCION_PASSWORD
    );

    // Obtener los IDs de las clínicas.
    const ids = ejecutarSQL(`
        SELECT
            (SELECT clinicid FROM public.clinics WHERE name = 'clínica central'),
            (SELECT clinicid FROM public.clinics WHERE name = 'clínica del este');
    `).split('|').map(Number);

    [clinicCentral, clinicEste] = ids;

    expect(clinicCentral).toBeGreaterThan(0);
    expect(clinicEste).toBeGreaterThan(0);

    // Obtener pacientes pertenecientes a cada clínica.
    pacienteCentral = Number(ejecutarSQL(`
        SELECT clinicpatientid
        FROM public.clinicpatients
        WHERE clinicid = ${clinicCentral}
          AND isactive = TRUE
        ORDER BY clinicpatientid
        LIMIT 1;
    `));

    pacienteEste = Number(ejecutarSQL(`
        SELECT clinicpatientid
        FROM public.clinicpatients
        WHERE clinicid = ${clinicEste}
          AND isactive = TRUE
        ORDER BY clinicpatientid
        LIMIT 1;
    `));

    expect(pacienteCentral).toBeGreaterThan(0);
    expect(pacienteEste).toBeGreaterThan(0);
});

describe('Aislamiento multi-tenant: filtro de aplicación vs RLS', () => {

    // 1. ESTRATEGIA NORMAL: MULTITENANCY POR CLINICID

    test('La API devuelve únicamente pacientes de la clínica autenticada', async () => {
        const respuesta = await request(API_URL)
            .get('/api/pacientes')
            .set('Authorization', `Bearer ${tokenCentral}`);

        expect(respuesta.status).toBe(200);
        expect(Array.isArray(respuesta.body)).toBe(true);
        expect(respuesta.body.length).toBeGreaterThan(0);

        // Intentar manipular el clinicId mediante parámetros.
        const manipulada = await request(API_URL)
            .get('/api/pacientes')
            .query({ clinicId: clinicEste })
            .set('Authorization', `Bearer ${tokenCentral}`);

        expect(manipulada.status).toBe(200);

        expect(
            manipulada.body.map(p => p.clinicpatientid).sort()
        ).toEqual(
            respuesta.body.map(p => p.clinicpatientid).sort()
        );

        // Intentar acceder a un paciente de otra clínica.
        const ajeno = await request(API_URL)
            .get(`/api/pacientes/${pacienteEste}`)
            .set('Authorization', `Bearer ${tokenCentral}`);

        expect(ajeno.status).toBe(404);

        // Verificar que sí permite acceder a un paciente propio.
        const propio = await request(API_URL)
            .get(`/api/pacientes/${pacienteCentral}`)
            .set('Authorization', `Bearer ${tokenCentral}`);

        expect(propio.status).toBe(200);
    });

    // 2. ESTRATEGIA RLS: SEGURIDAD A NIVEL DE BASE DE DATOS

    test('RLS permite consultar únicamente los registros de la clínica establecida', () => {
        const resultadoCentral = ejecutarSQL(`
            SET ROLE rol_security;
            SET app.clinic_id = '${clinicCentral}';

            SELECT clinicpatientid, clinicid
            FROM public.clinicpatients
            WHERE isactive = TRUE
            ORDER BY clinicpatientid;
        `);

        const filas = resultadoCentral
            .split('\n')
            .filter(linea => /^\d+\|\d+$/.test(linea))
            .map(linea => linea.split('|').map(Number));

        expect(filas.length).toBeGreaterThan(0);

        expect(
            filas.every(([, clinicId]) => clinicId === clinicCentral)
        ).toBe(true);

        expect(
            filas.some(([id]) => id === pacienteEste)
        ).toBe(false);
    });

    test('RLS impide leer, actualizar y eliminar registros de otra clínica', () => {
        const salida = ejecutarSQL(`
            SET ROLE rol_security;
            SET app.clinic_id = '${clinicCentral}';

            SELECT 'lectura', COUNT(*)
            FROM public.clinicpatients
            WHERE clinicid = ${clinicEste};

            WITH actualizados AS (
                UPDATE public.clinicpatients
                SET email = email
                WHERE clinicid = ${clinicEste}
                RETURNING clinicpatientid
            )
            SELECT 'actualizacion', COUNT(*)
            FROM actualizados;

            WITH eliminados AS (
                DELETE FROM public.clinicpatients
                WHERE clinicid = ${clinicEste}
                RETURNING clinicpatientid
            )
            SELECT 'eliminacion', COUNT(*)
            FROM eliminados;
        `);

        const resultados = salida.split('\n').filter(Boolean);

        expect(resultados).toContain('lectura|0');
        expect(resultados).toContain('actualizacion|0');
        expect(resultados).toContain('eliminacion|0');
    });

    // 3. COMPARACIÓN DE AMBAS ESTRATEGIAS

    test('Ambas estrategias devuelven el mismo conjunto de registros', () => {
        const normal = ejecutarSQL(`
            SELECT clinicpatientid, clinicid
            FROM public.clinicpatients
            WHERE clinicid = ${clinicCentral}
              AND isactive = TRUE
            ORDER BY clinicpatientid;
        `);

        const rls = ejecutarSQL(`
            SET ROLE rol_security;
            SET app.clinic_id = '${clinicCentral}';

            SELECT clinicpatientid, clinicid
            FROM public.clinicpatients
            WHERE isactive = TRUE
            ORDER BY clinicpatientid;
        `);

        expect(rls).toBe(normal);
    });

    test('Compara el tiempo de ejecución de ambas estrategias', () => {
        const repeticiones = 5;

        const tiemposNormal = [];
        const tiemposRLS = [];

        for (let i = 0; i < repeticiones; i++) {
            tiemposNormal.push(
                obtenerTiempoPlan(
                    ejecutarSQL(consultaNormal(clinicCentral))
                )
            );

            tiemposRLS.push(
                obtenerTiempoPlan(
                    ejecutarSQL(consultaRLS(clinicCentral))
                )
            );
        }

        const promedio = valores =>
            valores.reduce((total, valor) => total + valor, 0)
            / valores.length;

        const promedioNormal = promedio(tiemposNormal);
        const promedioRLS = promedio(tiemposRLS);

        const diferenciaPorcentual = promedioNormal === 0
            ? null
            : ((promedioRLS - promedioNormal) / promedioNormal) * 100;

        console.log('\nComparación de aislamiento (EXPLAIN ANALYZE):');

        console.table({
            'Filtro explícito (ms)': {
                promedio: promedioNormal
            },
            'RLS (ms)': {
                promedio: promedioRLS
            },
            'Diferencia RLS vs filtro (%)': {
                promedio: diferenciaPorcentual
            }
        });

        expect(promedioNormal).toBeGreaterThan(0);
        expect(promedioRLS).toBeGreaterThan(0);
    });
});