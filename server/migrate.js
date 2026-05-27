import './loadEnv.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const { rows: applied } = await pool.query('SELECT name FROM _migrations');
  const appliedSet = new Set(applied.map((r) => r.name));

  let appliedCount = 0;
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`= ${file} (already applied)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`> applying ${file}`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`+ ${file}`);
      appliedCount++;
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(`! ${file}:`, e.message);
      throw e;
    } finally {
      client.release();
    }
  }

  console.log(`done — ${appliedCount} migration(s) applied, ${files.length - appliedCount} already up to date`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
