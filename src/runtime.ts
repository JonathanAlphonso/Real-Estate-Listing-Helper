import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = path.join(__dirname, '..', 'data');
export const DEBUG_DIR = path.join(DATA_DIR, 'debug');

export function ensureDataDirectories(): { dataDir: string; debugDir: string } {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
  return { dataDir: DATA_DIR, debugDir: DEBUG_DIR };
}

export function validateAddress(address: string): string {
  const normalized = address.trim().replace(/\s+/g, ' ');

  if (!normalized) {
    throw new Error('Property address is required.');
  }

  if (normalized.length < 5) {
    throw new Error('Property address is too short to be valid.');
  }

  if (!/[A-Za-z]/.test(normalized)) {
    throw new Error('Property address must contain letters.');
  }

  if (!/^[A-Za-z0-9\s#.,'/-]+$/.test(normalized)) {
    throw new Error('Property address contains unsupported characters.');
  }

  const parts = normalized
    .split(',')
    .flatMap((segment) => segment.trim().split(/\s+/))
    .filter(Boolean);

  if (parts.length < 2) {
    throw new Error('Property address must include at least a street and municipality.');
  }

  if (!/\d/.test(normalized)) {
    throw new Error('Property address should include a street number.');
  }

  return normalized;
}

export function validateEnvironment(): void {
  // No API keys required — description generation is interactive.
  // Add future environment checks here if needed.
}
