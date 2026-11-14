class CustomConsoleReporter {
    constructor(globalConfig, options) {
        this._globalConfig = globalConfig;
        this._options = options;
    }

    onRunStart(results, options) {
        console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
        console.log('║                      MEDICITAS — SUITE DE PRUEBAS                            ║');
        console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');
    }

    onTestResult(test, testResult, aggregatedResult) {
        const filePath = testResult.testFilePath.replace(/\\/g, '/');
        const fileName = filePath.split('/').slice(-2).join('/');
        const isUnit = fileName.includes('unitarias');
        const categoria = isUnit ? 'PRUEBA UNITARIA' : 'PRUEBA DE INTEGRACIÓN';
        const colorTitle = isUnit ? '\x1b[36m' : '\x1b[35m'; // Cyan vs Magenta
        const reset = '\x1b[0m';
        const green = '\x1b[32m';
        const red = '\x1b[31m';
        const yellow = '\x1b[33m';

        console.log(`\n┌──────────────────────────────────────────────────────────────────────────────┐`);
        console.log(`│ ${colorTitle}${categoria}:${reset} ${fileName.padEnd(56)} │`);
        console.log(`├──────────────────────────────────────────────────────────────────────────────┤`);

        testResult.testResults.forEach((t) => {
            const statusSymbol = t.status === 'passed' ? `${green}✔ PASÓ${reset}` : `${red}✖ FALLÓ${reset}`;
            const duracion = `${yellow}${t.duration}ms${reset}`;
            const title = t.title.length > 56 ? t.title.slice(0, 53) + '...' : t.title.padEnd(56);
            console.log(`│  ${statusSymbol} │ ${title} │ ${duracion.padStart(8)} │`);
        });

        const statusSummary = testResult.numFailingTests === 0 ? `${green}EXITOSO${reset}` : `${red}CON ERRORES${reset}`;
        console.log(`├──────────────────────────────────────────────────────────────────────────────┤`);
        const info = `Estado: ${statusSummary}   |   Tiempo total: ${testResult.perfStats.runtime}ms`;
        console.log(`│ ${info.padEnd(84)} │`);
        console.log(`└──────────────────────────────────────────────────────────────────────────────┘`);
    }

    onRunComplete(contexts, results) {
        const green = '\x1b[32m';
        const red = '\x1b[31m';
        const bold = '\x1b[1m';
        const reset = '\x1b[0m';

        console.log('\n================================================================================');
        console.log(`                     ${bold}RESUMEN GLOBAL DE PRUEBAS MEDICITAS${reset}                     `);
        console.log('================================================================================');
        console.log(`  Suites de Pruebas:  ${green}${results.numPassedTestSuites} exitosas${reset}, ${results.numTotalTestSuites} total`);
        console.log(`  Casos de Prueba:    ${green}${results.numPassedTests} exitosos${reset}, ${results.numTotalTests} total`);
        if (results.numFailedTests > 0) {
            console.log(`  Fallos:             ${red}${results.numFailedTests} fallidos${reset}`);
        }
        console.log(`  Tiempo de corrida:  ${((Date.now() - results.startTime) / 1000).toFixed(2)}s`);
        console.log('================================================================================\n');
    }
}

module.exports = CustomConsoleReporter;