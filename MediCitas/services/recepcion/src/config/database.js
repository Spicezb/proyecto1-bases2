const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.RECEPCION_USER,
    password: process.env.RECEPCION_PASSWORD,
    max: 20
});

module.exports = pool;
