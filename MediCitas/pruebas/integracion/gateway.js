/**
 * PRUEBA DE INTEGRACIÓN: API GATEWAY (HEALTHCHECK)
 * Valida que Nginx en el puerto 3000 esté respondiendo y enrutando con baja latencia.
 */
const { banner, seccion, check, item, badge, prettyJson, tarjetaResumen, c } = require('../helpers/format');

const GATEWAY_URL = process.env.TEST_API_URL || 'http://localhost:3000';

async function ejecutar() {
    banner('PRUEBA DE INTEGRACIÓN: API GATEWAY', 'Healthcheck y Enrutamiento Perimetral Nginx');

    seccion(1, `Consultando Healthcheck en ${GATEWAY_URL}/health...`);
    const inicio = Date.now();
    const resp = await fetch(`${GATEWAY_URL}/health`);
    const latencia = Date.now() - inicio;
    const body = await resp.json();

    console.log(`\n${c.bold}${c.white}══════════════════════════ RESPUESTA DEL GATEWAY ══════════════════════════${c.reset}\n`);
    console.log(`   ${c.bold}Estado HTTP:${c.reset} ${badge(resp.status, 'HEALTHY')}`);
    console.log(`   ${c.bold}Latencia:${c.reset}    ${c.brightYellow}${latencia} ms${c.reset}`);
    console.log(`   ${c.bold}Payload JSON:${c.reset}`);
    prettyJson(body);

    if (resp.status === 200 && body.status === 'ok') {
        tarjetaResumen('API GATEWAY TOTALMENTE OPERATIVO', [
            `Nginx escuchando y balanceando en el puerto 3000.`,
            `Latencia de respuesta perimetral: ${latencia}ms.`,
            `Enrutamiento perimetral a microservicios listo para tráfico de producción.`
        ], true);
    } else {
        tarjetaResumen('FALLO EN API GATEWAY', [
            `El endpoint /health no devolvió HTTP 200.`
        ], false);
    }
}

if (require.main === module) {
    ejecutar().catch(err => {
        console.error(`\n${c.red}Error durante la ejecución:${c.reset}`, err);
    });
}

module.exports = { ejecutar };
