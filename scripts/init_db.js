import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

dotenv.config();

const configPath = path.join('./db_config.json');
const config = JSON.parse(await fs.readFile(configPath, 'utf8'));

const schemaPath = path.join('./sql/load_schema.sql');
let schema = await fs.readFile(schemaPath, 'utf8');

// Generate bcrypt hash for ADMIN_PASSWORD
const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminPassword) {
  console.error('ADMIN_PASSWORD not set in .env');
  process.exit(1);
}

console.log("Using administrator password", adminPassword)

const hash = await bcrypt.hash(adminPassword, 12);
schema = schema.replace('$2b$10$REPLACE_WITH_BCRYPT_HASH', hash);

// Connect to MySQL and run schema
try {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    multipleStatements: true // Required for executing full schema at once
  });

  console.log('Executing schema...');
  await connection.query(schema);
  console.log('Schema successfully loaded into MySQL.');

  await connection.end();
} catch (err) {
  console.error('Error loading schema:', err);
  process.exit(1);
}
