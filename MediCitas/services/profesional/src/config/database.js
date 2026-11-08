const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.PROFESIONAL_USER,
    password: process.env.PROFESIONAL_PASSWORD,
    max: 15
});

module.exports = pool;
