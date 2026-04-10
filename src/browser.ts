import { chromium, type BrowserContext, type Page } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureDataDirectories, DEBUG_DIR } from './runtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(__dirname, '..', 'browser-profile');

let context: BrowserContext | null = null;

export async function launchBrowser(options?: { debug?: boolean }): Promise<{ context: BrowserContext; page: Page }> {
  ensureDataDirectories();

  context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: ['--start-maximized'],
  });

  const page = context.pages()[0] || await context.newPage();

  if (options?.debug) {
    // In debug mode, pause opens Playwright Inspector for selector discovery
    console.log('[DEBUG] Playwright Inspector available — call page.pause() in steps to inspect.');
  }

  return { context, page };
}

export async function closeBrowser(): Promise<void> {
  if (context) {
    await context.close();
    context = null;
  }
}

export async function takeScreenshot(page: Page, name: string): Promise<string> {
  ensureDataDirectories();
  const filePath = path.join(DEBUG_DIR, `${name}-${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`[SCREENSHOT] Saved: ${filePath}`);
  return filePath;
}
