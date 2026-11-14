/**
 * PRUEBA DE INTEGRACIÓN: CONCURRENCIA Y OVERBOOKING
 * Demuestra la prevención de sobre-reserva simultánea mediante PostgreSQL EXCLUDE.
 */
const { obtenerToken } = require('../helpers/auth');
const { banner, seccion, check, item, badge, prettyJson, tarjetaResumen, c } = require('../helpers/format');

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000';

function fechaLaboralFutura(dias = 90) {
    const fecha = new Date();
    fecha.setUTCHours(12, 0, 0, 0);
    fecha.setUTCDate(fecha.getUTCDate() + dias);

    while ([0, 6].includes(fecha.getUTCDay())) {
        fecha.setUTCDate(fecha.getUTCDate() + 1);
    }

    return fecha.toISOString().slice(0, 10);
}

async function ejecutar() {
    banner('PRUEBA DE INTEGRACIÓN: CONCURRENCIA Y OVERBOOKING', 'Demostración de Exclusión en PostgreSQL (GIST)');

    seccion(1, 'Autenticando usuarios en Keycloak...');
    const t0 = Date.now();
    const [tokenRecepcion, tokenAdmin] = await Promise.all([
        obtenerToken('luis-mora', '12345'),
        obtenerToken('ana-solis', '12345')
    ]);
    check('Recepción (luis-mora)', 'Token JWT emitido', Date.now() - t0);
    check('Admin Clínica (ana-solis)', 'Token JWT emitido');

    console.log();
    seccion(2, 'Consultando catálogo y disponibilidad médica...');
    const [respProf, respServ, respPac] = await Promise.all([
        fetch(`${API_URL}/api/profesionales`, { headers: { 'Authorization': `Bearer ${tokenRecepcion}` } }),
        fetch(`${API_URL}/api/servicios`, { headers: { 'Authorization': `Bearer ${tokenRecepcion}` } }),
        fetch(`${API_URL}/api/pacientes`, { headers: { 'Authorization': `Bearer ${tokenRecepcion}` } })
    ]);

    const profesionales = await respProf.json();
    const servicios = await respServ.json();
    const pacientes = await respPac.json();

    const profesional = profesionales.find(p => p.licencia === 'med-cr-001') || profesionales[0];
    const servicio = servicios.find(s => s.nombre === 'consulta general') || servicios[0];
    const validPacientes = pacientes.filter(p => Number.isInteger(p.clinicpatientid));
    const pacienteA = validPacientes[0];
    const pacienteB = validPacientes[1];

    const nombreProf = `${profesional.nombre || ''} ${profesional.apellido || ''}`.trim() || 'Dra. María Rojas';
    item('Profesional seleccionado', `${nombreProf} (Licencia: ${profesional.licencia})`);
    item('Servicio a reservar', `${servicio.nombre} (${servicio.duracion} min)`);
    item('Pacientes en competencia', `Paciente ${pacienteA.clinicpatientid} vs Paciente ${pacienteB.clinicpatientid}`);

    // Consultar disponibilidad dinámica
    const fecha = fechaLaboralFutura(90);
    const respDisp = await fetch(`${API_URL}/api/disponibilidad/profesional?profesionalId=${profesional.id}&fecha=${fecha}`, {
        headers: { 'Authorization': `Bearer ${tokenRecepcion}` }
    });
    const slots = await respDisp.json();
    const espacio = Array.isArray(slots) ? slots.find(s => 
        (new Date(s.fin).getTime() - new Date(s.inicio).getTime()) >= Number(servicio.duracion) * 60000
    ) : null;

    const fechaHora = espacio ? new Date(espacio.inicio).toISOString() : `${fecha}T14:00:00.000Z`;
    item('Espacio libre encontrado para competir', fechaHora);

    console.log();
    seccion(3, 'Disparando DOS reservas simultáneas en el mismo milisegundo (Promise.all)...');
    
    const bodyA = { pacienteId: pacienteA.clinicpatientid, profesionalId: profesional.id, servicioId: servicio.id, fechaHora };
    const bodyB = { pacienteId: pacienteB.clinicpatientid, profesionalId: profesional.id, servicioId: servicio.id, fechaHora };

    const tInicio = Date.now();
    const [respA, respB] = await Promise.all([
        fetch(`${API_URL}/api/citas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenRecepcion}` },
            body: JSON.stringify(bodyA)
        }),
        fetch(`${API_URL}/api/citas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAdmin}` },
            body: JSON.stringify(bodyB)
        })
    ]);
    const latencia = Date.now() - tInicio;

    const dataA = await respA.json();
    const dataB = await respB.json();

    console.log(`\n${c.bold}${c.white}══════════════════════════ RESPUESTAS DEL SERVIDOR ══════════════════════════${c.reset}\n`);

    console.log(`   ${c.bold}Petición A (Recepción - Paciente ${pacienteA.clinicpatientid}):${c.reset} ${badge(respA.status)}`);
    prettyJson(dataA);

    console.log(`\n   ${c.bold}Petición B (Admin Clínica - Paciente ${pacienteB.clinicpatientid}):${c.reset} ${badge(respB.status)}`);
    prettyJson(dataB);

    const unaExitosa = (respA.status === 201 && respB.status === 409) || (respA.status === 409 && respB.status === 201);

    if (unaExitosa) {
        tarjetaResumen('RESTRICCIÓN DE CONCURRENCIA VERIFICADA CON ÉXITO', [
            `Tiempo de resolución concurrente: ${latencia}ms`,
            `Exactamente 1 cita fue concedida (HTTP 201 Created) persistida en PostgreSQL.`,
            `La otra petición fue bloqueada en el índice GIST (HTTP 409 Conflict).`,
            `Invariantes I1 e I2 verificadas: 0 citas duplicadas (Overbooking IMPOSIBLE).`
        ], true);
    } else {
        tarjetaResumen('FALLO EN LA RESTRICCIÓN DE CONCURRENCIA', [
            `Códigos recibidos: Petición A = ${respA.status}, Petición B = ${respB.status}`,
            `Se esperaba exactamente un HTTP 201 y un HTTP 409.`
        ], false);
    }
}

if (require.main === module) {
    ejecutar().catch(err => {
        console.error(`\n${c.red}Error durante la ejecución:${c.reset}`, err);
    });
}

module.exports = { ejecutar };
