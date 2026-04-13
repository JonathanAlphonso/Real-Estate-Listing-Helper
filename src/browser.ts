import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { ensureDataDirectories, IMAGES_DIR, BROWSER_DATA_DIR } from './runtime.js';

let browser: Browser | null = null;
let context: BrowserContext | null = null;

function getProfileDir(): string {
  return process.env.BROWSER_PROFILE_DIR || path.join(BROWSER_DATA_DIR, 'default-profile');
}

function getStorageStatePath(): string {
  return path.join(getProfileDir(), 'storage-state.json');
}

export async function launchBrowser(options?: { debug?: boolean }): Promise<{ context: BrowserContext; page: Page }> {
  ensureDataDirectories();
  const profileDir = getProfileDir();
  const storageStatePath = getStorageStatePath();

  fs.mkdirSync(profileDir, { recursive: true });

  browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });

  let storageState: Awaited<ReturnType<BrowserContext['storageState']>> | undefined;
  if (fs.existsSync(storageStatePath)) {
    try {
      storageState = JSON.parse(fs.readFileSync(storageStatePath, 'utf8'));
      const restoredCookies = storageState?.cookies?.length ?? 0;
      if (restoredCookies > 0) {
        console.log(`[Browser] Restored ${restoredCookies} saved cookies.`);
      }
    } catch {
      // Corrupted state file — ignore and let user log in fresh
    }
  }

  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState,
  });

  const page = await context.newPage();
  context.setDefaultTimeout(30_000);
  context.setDefaultNavigationTimeout(30_000);
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(30_000);

  if (options?.debug) {
    console.log('[DEBUG] Playwright Inspector available — call page.pause() in steps to inspect.');
  }

  return { context, page };
}

/**
 * Save the current browser auth state (all cookies + localStorage) to disk.
 * Call this after a successful login so subsequent runs can restore the session.
 */
export async function saveAuthState(): Promise<void> {
  if (!context) return;

  try {
    const state = await context.storageState();
    fs.writeFileSync(getStorageStatePath(), JSON.stringify(state, null, 2));
    console.log(`[Browser] Saved auth state (${state.cookies?.length ?? 0} cookies).`);
  } catch (error) {
    console.warn('[Browser] Failed to save auth state:', error);
  }
}

export async function closeBrowser(): Promise<void> {
  if (context) {
    // Always save auth state before closing so the next run can restore it
    await saveAuthState();
    await context.close();
    context = null;
  }

  if (browser) {
    await browser.close();
    browser = null;
  }
}

export async function takeScreenshot(page: Page, name: string): Promise<string> {
  ensureDataDirectories();
  const filePath = path.join(IMAGES_DIR, `${name}-${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`[SCREENSHOT] Saved: ${filePath}`);
  return filePath;
}
