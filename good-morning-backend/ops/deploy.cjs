const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');

const release = path.resolve(process.argv[2] || path.resolve(__dirname, '..'));
const sharedCandidates = [
  path.resolve(release, '..', '..', 'shared'),
  '/srv/good-morning/shared',
  '/srv/shared',
];
const shared = sharedCandidates.find((directory) => fs.existsSync(path.join(directory, 'app.env'))) || sharedCandidates[0];
const appFile = path.join(shared, 'app.env');
const deployFile = path.join(shared, 'deploy.env');

function readEnv(file) {
  if (!fs.existsSync(file)) throw new Error(`Required server environment file is missing: ${file}`);
  return dotenv.parse(fs.readFileSync(file));
}
function run(script, env) {
  const result = spawnSync(process.execPath, [path.join(release, script)], { cwd: release, env: { ...process.env, ...env }, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} exited with status ${result.status}`);
}
function runPm2(env) {
  const result = spawnSync('pm2', ['startOrReload', path.join(release, 'ecosystem.config.cjs'), '--update-env'], {
    cwd: release, env: { ...process.env, ...env }, stdio: 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`PM2 exited with status ${result.status}`);
}

try {
  const appEnv = readEnv(appFile);
  const deployEnv = readEnv(deployFile);
  if (!appEnv.DATABASE_URL || !appEnv.JWT_SECRET || !appEnv.FRONTEND_URL) throw new Error('app.env needs DATABASE_URL, JWT_SECRET, and FRONTEND_URL.');
  if (!deployEnv.MIGRATION_DATABASE_URL || !deployEnv.SEED_SUPER_EMAIL || !deployEnv.SEED_SUPER_PASSWORD) throw new Error('deploy.env needs MIGRATION_DATABASE_URL, SEED_SUPER_EMAIL, and SEED_SUPER_PASSWORD.');

  const migrationEnv = { ...appEnv, MIGRATION_DATABASE_URL: deployEnv.MIGRATION_DATABASE_URL };
  run('dist/db/provision.js', migrationEnv);
  run('dist/db/migrate.js', { ...migrationEnv, DATABASE_URL: deployEnv.MIGRATION_DATABASE_URL });
  run('dist/seed.js', { ...appEnv, SEED_SUPER_EMAIL: deployEnv.SEED_SUPER_EMAIL, SEED_SUPER_PASSWORD: deployEnv.SEED_SUPER_PASSWORD, SEED_SUPER_NAME: deployEnv.SEED_SUPER_NAME || 'Super Manager' });

  const envLink = path.join(release, '.env');
  try { fs.unlinkSync(envLink); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  fs.symlinkSync(appFile, envLink);
  const runtimeEnv = { ...appEnv, NODE_ENV: 'production', PORT: appEnv.PORT || '4000' };
  runPm2(runtimeEnv);
  const saved = spawnSync('pm2', ['save'], { env: { ...process.env, ...runtimeEnv }, stdio: 'inherit' });
  if (saved.error) throw saved.error;
  if (saved.status !== 0) throw new Error('pm2 save failed.');
  console.log(`Deployed Good Morning API from ${release}`);
} catch (error) {
  console.error('Deployment failed:', error.message);
  process.exit(1);
}
