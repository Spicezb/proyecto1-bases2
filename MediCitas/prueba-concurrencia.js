
const url = 'http://localhost:3000/api/citas';

const reservas = [
    {
        pacienteId: 61,
        profesionalId: 5,
        servicioId: 2,
        fechaHora: '2026-11-18T20:00:00.000Z'
    },
    {
        pacienteId: 3,
        profesionalId: 5,
        servicioId: 2,
        fechaHora: '2026-11-18T20:00:00.000Z'
    }
];

async function reservar(datos) {
    const respuesta = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(datos)
    });

    return {
        pacienteId: datos.pacienteId,
        status: respuesta.status,
        body: await respuesta.json()
    };
}

async function ejecutarPrueba() {
    const resultados = await Promise.all(
        reservas.map(reservar)
    );

    console.log(JSON.stringify(resultados, null, 2));
}

ejecutarPrueba().catch(console.error);
