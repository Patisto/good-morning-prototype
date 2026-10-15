import fs from 'fs';
import path from 'path';
import { transaction } from '../utils/http';
import { pool } from './pool';
async function migrate() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    console.log('Applying schema...');
    await transaction(db => db.query(schema));
    console.log('Schema is up to date.');
}
migrate()
    .catch((err) => {
    console.error('Migration failed:', err);
    process.exitCode = 1;
})
    .finally(() => pool.end());
