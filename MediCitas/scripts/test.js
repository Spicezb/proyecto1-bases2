const { spawnSync } = require("child_process");

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function ejecutar(comando, argumentos) {
    const resultado = spawnSync(comando, argumentos, {
        stdio: "inherit",
        shell: process.platform === "win32"
    });

    if (resultado.error) {
        console.error(resultado.error);
        process.exit(1);
    }

    if (resultado.status !== 0) {
        process.exit(resultado.status || 1);
    }
}

console.log("Instalando dependencias de pruebas...");
ejecutar(npm, ["ci", "--prefix", "pruebas"]);

console.log("Ejecutando pruebas...");
ejecutar(npm, ["test", "--prefix", "pruebas"]);

console.log("Pruebas finalizadas correctamente.");