import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const DATA_DIR = path.join(__dirname, '..', 'data');
export const ARTIFACTS_DIR = path.join(__dirname, '..', 'artifacts');
export const IMAGES_DIR = path.join(ARTIFACTS_DIR, 'images');
export const BROWSER_DATA_DIR = path.join(ARTIFACTS_DIR, 'browser-data');

export function ensureDataDirectories(): {
  dataDir: string;
  artifactsDir: string;
  imagesDir: string;
  browserDataDir: string;
} {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  fs.mkdirSync(BROWSER_DATA_DIR, { recursive: true });
  return {
    dataDir: DATA_DIR,
    artifactsDir: ARTIFACTS_DIR,
    imagesDir: IMAGES_DIR,
    browserDataDir: BROWSER_DATA_DIR,
  };
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
