const disponibilidadRepositorio = require('../repositorios/disponibilidad_repos');
const redis = require('../config/redis');

// Validar formato YYYY-MM-DD
function esFechaValida(fechaStr) {
    if (typeof fechaStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
        return false;
    }
    const fecha = new Date(fechaStr);
    return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === fechaStr;
}

// Generador de clave multi-tenant para Redis
function construirClaveDisponibilidad(clinicId, profesionalId, fecha) {
    return `medicitas:disp:${clinicId}:prof:${profesionalId}:date:${fecha}`;
}

// RF7: Disponibilidad de un profesional en una fecha (con Caché L2 en Redis)
async function consultarDisponibilidadProfesional(clinicId, auditPersonId, profesionalId, fecha, roleName = null) {
    if (!/^[1-9]\d*$/.test(String(profesionalId))) {
        return {
            error: 'El ID del profesional debe ser un entero positivo.',
            status: 400
        };
    }

    if (!esFechaValida(fecha)) {
        return {
            error: 'La fecha debe ser válida con formato YYYY-MM-DD.',
            status: 400
        };
    }

    // El SP restringe al profesional de salud a su propia agenda; omitir caché compartida evita lecturas indebidas
    const usarCache = roleName !== 'profesional de salud';
    const cacheKey = construirClaveDisponibilidad(clinicId, profesionalId, fecha);

    if (usarCache) {
        // 1. Intentar lectura desde Redis (Cache-Aside)
        const datosCacheados = await redis.getCache(cacheKey);
        if (datosCacheados) {
            return { espacios: datosCacheados, origen: 'cache' };
        }
    }

    // 2. Cache Miss o consulta directa: Consultar la base de datos (PostgreSQL SP)
    const espacios = await disponibilidadRepositorio.consultarDisponibilidadProfesional(
        clinicId,
        auditPersonId,
        Number(profesionalId),
        fecha
    );

    if (usarCache) {
        // 3. Escribir en Redis con TTL de respaldo (fail-safe)
        await redis.setCache(cacheKey, espacios);
    }

    return { espacios, origen: 'db' };
}

// RF8: Disponibilidad por servicio en un rango de fechas
async function consultarDisponibilidadServicio(clinicId, auditPersonId, servicioId, fechaInicio, fechaFin) {
    if (!/^[1-9]\d*$/.test(String(servicioId))) {
        return {
            error: 'El ID del servicio debe ser un entero positivo.',
            status: 400
        };
    }

    if (!esFechaValida(fechaInicio) || !esFechaValida(fechaFin)) {
        return {
            error: 'Las fechas deben ser válidas con formato YYYY-MM-DD.',
            status: 400
        };
    }

    if (fechaInicio > fechaFin) {
        return {
            error: 'La fecha inicial no puede ser posterior a la fecha final.',
            status: 400
        };
    }

    const disponibilidad = await disponibilidadRepositorio.consultarDisponibilidadServicio(
        clinicId,
        auditPersonId,
        Number(servicioId),
        fechaInicio,
        fechaFin
    );

    return { disponibilidad };
}

module.exports = {
    consultarDisponibilidadProfesional,
    consultarDisponibilidadServicio,
    construirClaveDisponibilidad
};
