const Redis = require('ioredis');

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;
const DEFAULT_TTL = Number(process.env.REDIS_TTL_SECONDS) || 900;

let isConnected = false;

const redisClient = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
        const delay = Math.min(times * 200, 3000);
        return delay;
    },
    lazyConnect: false
});

redisClient.on('connect', () => {
    isConnected = true;
    console.log(`[Redis:AdminClínica] Conectado exitosamente a ${REDIS_HOST}:${REDIS_PORT}`);
});

redisClient.on('ready', () => {
    isConnected = true;
});

redisClient.on('error', (err) => {
    isConnected = false;
    console.warn(`[Redis:AdminClínica Warning] Error de conexión: ${err.message}`);
});

redisClient.on('close', () => {
    isConnected = false;
});

async function getCache(key) {
    if (!isConnected) return null;
    try {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        console.warn(`[Redis:AdminClínica] Error al leer llave "${key}": ${err.message}`);
        return null;
    }
}

async function setCache(key, value, ttlSeconds = DEFAULT_TTL) {
    if (!isConnected) return false;
    try {
        const payload = JSON.stringify(value);
        await redisClient.set(key, payload, 'EX', ttlSeconds);
        return true;
    } catch (err) {
        console.warn(`[Redis:AdminClínica] Error al escribir llave "${key}": ${err.message}`);
        return false;
    }
}

async function deleteCache(key) {
    if (!isConnected) return false;
    try {
        await redisClient.del(key);
        return true;
    } catch (err) {
        console.warn(`[Redis:AdminClínica] Error al borrar llave "${key}": ${err.message}`);
        return false;
    }
}

async function deleteKeysByPattern(pattern) {
    if (!isConnected) return 0;
    try {
        const stream = redisClient.scanStream({
            match: pattern,
            count: 50
        });

        let deletedCount = 0;
        for await (const keys of stream) {
            if (keys && keys.length > 0) {
                const pipeline = redisClient.pipeline();
                keys.forEach(k => pipeline.del(k));
                await pipeline.exec();
                deletedCount += keys.length;
            }
        }
        return deletedCount;
    } catch (err) {
        console.warn(`[Redis:AdminClínica] Error al invalidar patrón "${pattern}": ${err.message}`);
        return 0;
    }
}

function isRedisReady() {
    return isConnected;
}

module.exports = {
    redisClient,
    getCache,
    setCache,
    deleteCache,
    deleteKeysByPattern,
    isRedisReady,
    DEFAULT_TTL
};
