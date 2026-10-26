import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const migrationConnection = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!migrationConnection) throw new Error('MIGRATION_DATABASE_URL is required to create the application database.');

/** Create good_morning on first deployment, then set safe runtime defaults. */
async function provision() {
    const adminUrl = new URL(migrationConnection);
    adminUrl.pathname = '/postgres';
    const admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    try {
        const found = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', ['good_morning']);
        if (found.rowCount === 0) {
            // This identifier is fixed; parameterized queries cannot create database names.
            await admin.query('CREATE DATABASE good_morning OWNER good_morning_migrator');
            console.log('Created database good_morning.');
        } else console.log('Database good_morning already exists; preserving its data.');
    } finally { await admin.end(); }

    const db = new Client({ connectionString: migrationConnection });
    await db.connect();
    try {
        await db.query('GRANT CONNECT ON DATABASE good_morning TO good_morning_app');
        await db.query('GRANT USAGE ON SCHEMA public TO good_morning_app');
        await db.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO good_morning_app');
        await db.query('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO good_morning_app');
        await db.query(`ALTER DEFAULT PRIVILEGES FOR ROLE good_morning_migrator IN SCHEMA public
            GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO good_morning_app`);
        await db.query(`ALTER DEFAULT PRIVILEGES FOR ROLE good_morning_migrator IN SCHEMA public
            GRANT USAGE,SELECT ON SEQUENCES TO good_morning_app`);
    } finally { await db.end(); }
}

provision().catch(error => { console.error('Database provisioning failed:', error); process.exitCode = 1; });
