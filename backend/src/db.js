const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'uptime',
  password: process.env.DB_PASSWORD || 'uptime',
  database: process.env.DB_NAME || 'uptime',
  max: 10,
});

module.exports = pool;
