const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.ADMIN_CLINICA_USER,
    password: process.env.ADMIN_CLINICA_PASSWORD,
    max: 15
});

module.exports = pool;
