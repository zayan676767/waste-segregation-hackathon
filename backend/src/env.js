import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, '..', '.env');

/**
 * Loads backend/.env into process.env, at import time on purpose.
 *
 * ES modules finish every import before the importing file's own code runs, so
 * a loadEnv() call placed among the imports in server.js would execute too late
 * for any module that reads process.env while being evaluated. Doing it here
 * means importing this module first is enough to guarantee the ordering.
 *
 * Uses Node's built-in loader rather than the dotenv package so there is one
 * less dependency to install on a borrowed laptop. The file is git-ignored and
 * holds the Gemini keys — it must never be committed.
 */
function load() {
  if (!existsSync(ENV_PATH)) return false;
  try {
    process.loadEnvFile(ENV_PATH);
    return true;
  } catch (err) {
    console.warn('[env] could not read .env:', err.message);
    return false;
  }
}

export const envLoaded = load();
export { ENV_PATH };
