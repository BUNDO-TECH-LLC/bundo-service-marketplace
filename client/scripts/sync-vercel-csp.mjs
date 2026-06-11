#!/usr/bin/env node
/**
 * Syncs VITE_API_BASE_URL into vercel.json CSP connect-src before production builds.
 * Run automatically via `npm run prebuild` in the client package.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vercelPath = path.join(__dirname, '..', 'vercel.json');
const apiBaseUrl = process.env.VITE_API_BASE_URL?.trim();

if (!apiBaseUrl) {
  console.warn('[sync-vercel-csp] VITE_API_BASE_URL is unset; leaving vercel.json unchanged.');
  process.exit(0);
}

let origin;
try {
  origin = new URL(apiBaseUrl).origin;
} catch {
  console.warn('[sync-vercel-csp] VITE_API_BASE_URL is invalid; leaving vercel.json unchanged.');
  process.exit(0);
}

const config = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
const headersBlock = config.headers?.find((entry) => entry.source === '/(.*)');
const cspHeader = headersBlock?.headers?.find((entry) => entry.key === 'Content-Security-Policy');

if (!cspHeader?.value) {
  console.warn('[sync-vercel-csp] CSP header not found in vercel.json.');
  process.exit(0);
}

const connectSrcMatch = cspHeader.value.match(/connect-src ([^;]+)/);
if (!connectSrcMatch) {
  console.warn('[sync-vercel-csp] connect-src directive not found.');
  process.exit(0);
}

const parts = connectSrcMatch[1].split(/\s+/).filter(Boolean);
const preserved = parts.filter(
  (part) =>
    part === "'self'" ||
    part.startsWith('https://*.') ||
    part.startsWith('wss://') ||
    part.includes('google') ||
    part.includes('firebase') ||
    part.includes('recaptcha')
);
const nextConnectSrc = ["'self'", origin, ...preserved.filter((part) => part !== "'self'")];
cspHeader.value = cspHeader.value.replace(connectSrcMatch[0], `connect-src ${nextConnectSrc.join(' ')}`);

fs.writeFileSync(vercelPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`[sync-vercel-csp] Injected ${origin} into connect-src.`);
