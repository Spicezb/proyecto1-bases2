/**
 * Helper de formateo y colores ANSI para terminales modernas (PowerShell, Linux, macOS).
 */
const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    
    // Texto
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    brightGreen: '\x1b[92m',
    brightYellow: '\x1b[93m',
    brightCyan: '\x1b[96m',
    
    // Fondos (Badges)
    bgGreen: '\x1b[42m',
    bgRed: '\x1b[41m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
    bgGray: '\x1b[100m'
};

function banner(titulo, subtitulo = '') {
    const ancho = 70;
    const linea = '═'.repeat(ancho - 2);
    const espT = Math.max(0, Math.floor((ancho - 2 - titulo.length) / 2));
    const padT = ' '.repeat(espT);
    const titPadded = (padT + titulo).padEnd(ancho - 2, ' ');

    console.log(`\n${c.bold}${c.cyan}╔${linea}╗${c.reset}`);
    console.log(`${c.bold}${c.cyan}║${c.white}${titPadded}${c.cyan}║${c.reset}`);
    if (subtitulo) {
        const espS = Math.max(0, Math.floor((ancho - 2 - subtitulo.length) / 2));
        const subPadded = (' '.repeat(espS) + subtitulo).padEnd(ancho - 2, ' ');
        console.log(`${c.bold}${c.cyan}║${c.dim}${c.yellow}${subPadded}${c.cyan}║${c.reset}`);
    }
    console.log(`${c.bold}${c.cyan}╚${linea}╝${c.reset}\n`);
}

function seccion(numero, texto) {
    console.log(`${c.bold}${c.yellow}${numero}. ${texto}${c.reset}`);
}

function check(label, detalle = '', ms = null) {
    const time = ms ? ` ${c.dim}(${ms}ms)${c.reset}` : '';
    console.log(`   ${c.brightGreen}${c.bold}✔${c.reset} ${c.white}${label}${c.reset} ${c.brightGreen}${detalle}${c.reset}${time}`);
}

function item(label, valor) {
    console.log(`   ${c.cyan}→${c.reset} ${c.white}${label}:${c.reset} ${c.brightCyan}${valor}${c.reset}`);
}

function badge(codigo, texto) {
    if (codigo >= 200 && codigo < 300) {
        return `${c.bgGreen}${c.black}${c.bold} HTTP ${codigo} ${texto || 'OK'} ${c.reset}`;
    } else if (codigo === 409) {
        return `${c.bgYellow}${c.black}${c.bold} HTTP 409 CONFLICT ${c.reset}`;
    } else if (codigo === 401 || codigo === 403) {
        return `${c.bgMagenta}${c.white}${c.bold} HTTP ${codigo} ${texto || 'DENIED'} ${c.reset}`;
    } else if (codigo >= 400) {
        return `${c.bgRed}${c.white}${c.bold} HTTP ${codigo} ${texto || 'ERROR'} ${c.reset}`;
    }
    return `${c.bgBlue}${c.white}${c.bold} HTTP ${codigo} ${c.reset}`;
}

function prettyJson(obj, indent = '     ') {
    const str = JSON.stringify(obj, null, 2);
    const lineas = str.split('\n').map(l => `${indent}${c.dim}${l}${c.reset}`).join('\n');
    console.log(lineas);
}

function tarjetaResumen(titulo, lineas, esExito = true) {
    const ancho = 70;
    const borderCol = esExito ? c.brightGreen : c.red;
    const linea = '═'.repeat(ancho - 2);
    
    console.log(`\n${c.bold}${borderCol}╔${linea}╗${c.reset}`);
    console.log(`${c.bold}${borderCol}║  ${esExito ? '✔' : '✖'} ${titulo.padEnd(ancho - 6)}║${c.reset}`);
    console.log(`${c.bold}${borderCol}╠${linea}╣${c.reset}`);
    lineas.forEach(l => {
        const text = `  ${c.white}• ${l}${c.reset}`;
        console.log(`${c.bold}${borderCol}║${c.reset}${text}`);
    });
    console.log(`${c.bold}${borderCol}╚${linea}╝${c.reset}\n`);
}

module.exports = {
    c,
    banner,
    seccion,
    check,
    item,
    badge,
    prettyJson,
    tarjetaResumen
};
