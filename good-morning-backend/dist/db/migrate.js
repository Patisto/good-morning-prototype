"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pool_1 = require("./pool");
async function migrate() {
    const schemaPath = path_1.default.join(__dirname, 'schema.sql');
    const schema = fs_1.default.readFileSync(schemaPath, 'utf-8');
    console.log('Applying schema...');
    await pool_1.pool.query(schema);
    console.log('Schema is up to date.');
}
migrate()
    .catch((err) => {
    console.error('Migration failed:', err);
    process.exitCode = 1;
})
    .finally(() => pool_1.pool.end());
//# sourceMappingURL=migrate.js.map