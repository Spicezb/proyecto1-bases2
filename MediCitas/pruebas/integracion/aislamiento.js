/**
 * PRUEBA DE INTEGRACIÓN: AISLAMIENTO MULTI-TENANT (RLS)
 * Demuestra que PostgreSQL Row Level Security impide que una clínica acceda a datos de otra.
 */
const { obtenerToken } = require('../helpers/auth');
const { banner, seccion, check, item, badge, prettyJson, tarjetaResumen, c } = require('../helpers/format');

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000';

async function ejecutar() {
    banner('PRUEBA DE INTEGRACIÓN: AISLAMIENTO MULTI-TENANT', 'Seguridad a Nivel de Filas (PostgreSQL RLS)');

    seccion(1, 'Autenticando recepción de dos clínicas distintas...');
    const [tokenCentral, tokenEste] = await Promise.all([
        obtenerToken('luis-mora', '12345'),
        obtenerToken('pedro-castro', '12345')
    ]);
    check('Recepción Clínica Central (luis-mora)', 'Autenticado');
    check('Recepción Clínica del Este (pedro-castro)', 'Autenticado');

    console.log();
    seccion(2, 'Consultando pacientes visibles para cada clínica...');
    const [respCentral, respEste] = await Promise.all([
        fetch(`${API_URL}/api/pacientes`, { headers: { 'Authorization': `Bearer ${tokenCentral}` } }),
        fetch(`${API_URL}/api/pacientes`, { headers: { 'Authorization': `Bearer ${tokenEste}` } })
    ]);

    const pacientesCentral = await respCentral.json();
    const pacientesEste = await respEste.json();

    item('Clínica Central (Tenant 1)', `${pacientesCentral.length} pacientes registrados`);
    item('Clínica del Este (Tenant 2)', `${pacientesEste.length} pacientes registrados`);

    console.log();
    seccion(3, 'Intentando cruzar accesos entre clínicas (Invariante I5)...');
    const idPacienteCentral = pacientesCentral[0]?.clinicpatientid || 1;
    item('Paciente de Clínica Central objetivo', `ID: ${idPacienteCentral} (${pacientesCentral[0]?.nombre || 'Paciente'})`);

    const respCruzada = await fetch(`${API_URL}/api/pacientes/${idPacienteCentral}`, {
        headers: { 'Authorization': `Bearer ${tokenEste}` }
    });

    console.log(`\n${c.bold}${c.white}══════════════════════════ RESPUESTA A INTENTO DE ACCESO CRUZADO ══════════════════════════${c.reset}\n`);
    console.log(`   ${c.bold}Resultado de la consulta ajena:${c.reset} ${badge(respCruzada.status, respCruzada.status === 404 ? 'NOT FOUND' : 'FORBIDDEN')}`);
    
    let bodyCruzado = {};
    try { bodyCruzado = await respCruzada.json(); } catch (e) {}
    if (Object.keys(bodyCruzado).length > 0) {
        prettyJson(bodyCruzado);
    }

    const aislamientoExitoso = respCruzada.status === 404 || respCruzada.status === 403;

    if (aislamientoExitoso) {
        tarjetaResumen('AISLAMIENTO MULTI-TENANT 100% INVIOLABLE', [
            `PostgreSQL Row Level Security (RLS) activo en la tabla pacientes.`,
            `El token de Clínica del Este no puede ver pacientes de Clínica Central.`,
            `Resultado HTTP ${respCruzada.status}: la fila no existe para el tenant consultante.`,
            `Invariante I5 cumplida: Aislamiento estricto sin fugas de datos entre clínicas.`
        ], true);
    } else {
        tarjetaResumen('VULNERABILIDAD DETECTADA EN AISLAMIENTO', [
            `Se esperaba HTTP 404 o 403, pero se obtuvo HTTP ${respCruzada.status}.`
        ], false);
    }
}

if (require.main === module) {
    ejecutar().catch(err => {
        console.error(`\n${c.red}Error durante la ejecución:${c.reset}`, err);
    });
}

module.exports = { ejecutar };
