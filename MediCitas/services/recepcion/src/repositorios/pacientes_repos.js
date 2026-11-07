const pool = require('../config/database');

//Obtener los pacientes de una clinica
async function obtenerPacientes(clinicId,auditPersonId) {

    const query = `
        SELECT * FROM consultarpacientes($1,$2)
    `;

    const resultado = await pool.query(query, [clinicId,auditPersonId]); 

    return resultado.rows;
}

//Obtener un paciente especifico de una clinica
async function obtenerPacientePorId(id, clinicId, auditPersonId) {

    const query = `
        SELECT * FROM consultarpacientes($1,$2,$3)
    `;

    const resultado = await pool.query(query, [clinicId,auditPersonId,id]); 

    return resultado.rows[0];
}

//Registrar paciente en PostgreSQL
async function registrarPaciente(datos, clinicId, auditPersonId) {
    const {
        identificacion,
        nombre,
        apellido,
        fechaNacimiento,
        correo,
        telefono
    } = datos;

    const resultado = await pool.query(
        `CALL crearpaciente($1, $2, $3, $4, $5, $6, $7, $8, NULL)`,
        [
            clinicId,
            auditPersonId,  
            identificacion,
            nombre,
            apellido,
            fechaNacimiento,
            correo || null,
            telefono || null
        ]
    );

    return {
        id: resultado.rows[0].p_clinicpatientid,
        identificacion,
        nombre,
        apellido,
        fechaNacimiento,
        correo: correo || null,
        telefono: telefono || null
    };
}

//Actualizar un paciente en PostgreSQL
async function actualizarPaciente(id, datos, clinicId, auditPersonId) {
    const {
        identificacion,
        nombre,
        apellido,
        fechaNacimiento,
        correo,
        telefono
    } = datos;

    await pool.query(
        `CALL actualizarpaciente($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
            clinicId,
            auditPersonId,
            id,
            identificacion,
            nombre,
            apellido,
            fechaNacimiento,
            correo || null,
            telefono || null
        ]
    );

    // Reutilizar la consulta que ya existe
    return await obtenerPacientePorId(id, clinicId, auditPersonId);
}

module.exports = {
    obtenerPacientes,
    obtenerPacientePorId,
    registrarPaciente,
    actualizarPaciente
};