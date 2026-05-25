const mysql = require('mysql2/promise');

const initDatabase = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  });

  const dbName = process.env.DB_NAME || 'keeneed';
  await connection.query('CREATE DATABASE IF NOT EXISTS ??', [dbName]);
  await connection.query('USE ??', [dbName]);

  return connection;
};

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'keeneed',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = { initDatabase, pool };
