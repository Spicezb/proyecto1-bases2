const { spawnSync } = require("child_process");
const path = require("path");

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const pruebasDir = path.resolve(__dirname, "..", "pruebas");

function ejecutar(comando, argumentos, cwd = pruebasDir) {
    const resultado = spawnSync(comando, argumentos, {
        stdio: "inherit",
        shell: process.platform === "win32",
        cwd
    });

    if (resultado.error) {
        console.error(resultado.error);
        process.exit(1);
    }

    if (resultado.status !== 0) {
        process.exit(resultado.status || 1);
    }
}

// Ejecutar Jest desde la carpeta pruebas para que cargue la configuración y el reporter estilizado
ejecutar(npx, ["jest", "--runInBand"]);