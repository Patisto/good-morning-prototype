import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const configuredApiUrl = process.env.PAYMENT_API_BASE_URL?.trim();
let apiBaseUrl;
try {
  const parsed = new URL(configuredApiUrl);
  if (parsed.protocol !== 'https:' || (parsed.pathname.replace(/\/+$/, '') !== '' && parsed.pathname.replace(/\/+$/, '') !== '/api') || parsed.search || parsed.hash) {
    throw new Error();
  }
  apiBaseUrl = `${parsed.origin}/api`;
} catch {
  throw new Error('Set PAYMENT_API_BASE_URL to the HTTPS Render service URL, optionally ending in /api.');
}

const sourcePath = resolve('code.html');
const outputDirectory = resolve('dist');
const html = (await readFile(sourcePath, 'utf8')).replaceAll('__PAYMENT_API_BASE_URL__', apiBaseUrl);
if (html.includes('__PAYMENT_API_BASE_URL__') || html.includes('http://localhost:4000/api')) {
  throw new Error('Payment portal API URL was not configured in the built page.');
}

await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, 'index.html'), html);
