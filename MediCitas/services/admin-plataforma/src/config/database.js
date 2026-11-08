const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.ADMIN_GENERAL_USER,
    password: process.env.ADMIN_GENERAL_PASSWORD,
    max: 10
});

module.exports = pool;
