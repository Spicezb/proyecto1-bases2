const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.PGHOST || 'postgres',
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || 'medicitas',
    user: process.env.PGUSER || 'medicitas_user',
    password: process.env.PGPASSWORD || '123456',
    max: 10
});

module.exports = pool;
