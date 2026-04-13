import type { Page } from 'playwright';
import type { WorkflowContext } from '../types/workflow-state.js';
import { urls } from '../../config/urls.js';
import { skyslopeSelectors } from '../../config/selectors/skyslope.js';
import { takeScreenshot, saveAuthState } from '../browser.js';

const SKYSLOPE_LOGIN_TIMEOUT_MS = 30_000;
const UI_SETTLE_MS = 100;
const FAST_POLL_MS = 250;

export async function run(ctx: WorkflowContext): Promise<void> {
  console.log('[Step 5] Opening SkySlope Forms...');

  const page = ctx.page;

  await page.goto(urls.skyslopeLogin, { waitUntil: 'domcontentloaded' });
  await waitForLoginSurface(page);

  // If redirected to the marketing page, look for a Sign In link
  if (isMarketingPage(page.url())) {
    console.log('[Step 5] On marketing page. Looking for sign-in link...');
    await tryClickSignIn(page);
    await waitForLoginSurface(page);
  }

  // Check if already logged in (cookies restored)
  if (await isSkySlapeLoggedIn(page)) {
    console.log('[Step 5] Already logged in to SkySlope.');
    await saveAuthState();
    return;
  }

  // Try auto-login with .env credentials
  const email = process.env.SKYSLOPE_EMAIL;
  const password = process.env.SKYSLOPE_PASSWORD;

  if (email && password) {
    console.log(`[Step 5] Auto-logging in as ${email}...`);
    const autoLoginOk = await attemptAutoLogin(page, email, password);
    if (autoLoginOk) {
      await saveAuthState();
      console.log('[Step 5] SkySlope auto-login complete.');
      return;
    }
    await takeScreenshot(page, 'skyslope-login-automation-failed');
    throw new Error(`SkySlope auto-login did not complete within ${SKYSLOPE_LOGIN_TIMEOUT_MS / 1000}s. Current URL: ${page.url()}`);
  }

  await takeScreenshot(page, 'skyslope-missing-credentials');
  throw new Error('SkySlope credentials are required for unattended runs. Set SKYSLOPE_EMAIL and SKYSLOPE_PASSWORD in .env.');
}

function isMarketingPage(url: string): boolean {
  const u = url.toLowerCase();
  return u.includes('skyslope.com/forms-login') || u.includes('skyslope.com/forms');
}

async function isSkySlapeLoggedIn(page: Page): Promise<boolean> {
  const url = page.url().toLowerCase();
  if (url.includes('/files') || url.includes('/create') || url.includes('/file/')) {
    return true;
  }

  return page.locator(skyslopeSelectors.postLoginIndicator)
    .first()
    .isVisible()
    .catch(() => false);
}

async function attemptAutoLogin(page: Page, email: string, password: string): Promise<boolean> {
  // Look for the Okta login form (SkySlope uses Okta SSO)
  const emailSelectors = [
    skyslopeSelectors.loginEmailInput,
    'input[name="identifier"]',
    'input[name="username"]',
    'input[type="email"]',
    'input[name="email"]',
  ];

  let emailInput = null;
  for (const selector of emailSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 3000 })) {
        emailInput = el;
        break;
      }
    } catch { /* try next */ }
  }

  if (!emailInput) {
    await takeScreenshot(page, 'skyslope-no-login-form');
    return false;
  }

  // Dismiss cookie consent overlays (OneTrust) that block interaction
  await dismissCookieConsent(page);

  // Fill email
  await emailInput.click();
  await emailInput.fill(email);
  await page.waitForTimeout(UI_SETTLE_MS);

  // Click Next/Submit for email step
  const nextClicked = await tryClickButton(page, ['Next', 'Sign in', 'Submit', 'Continue']);
  if (nextClicked) {
    await waitForPasswordSurface(page);
  }

  // Fill password
  const passwordSelectors = [
    skyslopeSelectors.loginPasswordInput,
    'input[name="credentials.passcode"]',
    'input[name="password"]',
    'input[type="password"]',
  ];

  for (const selector of passwordSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 3000 })) {
        await el.click();
        await el.fill(password);
        await page.waitForTimeout(UI_SETTLE_MS);

        // Click Sign In / Verify
        await tryClickButton(page, ['Sign in', 'Verify', 'Submit', 'Log in', 'Next']);
        break;
      }
    } catch { /* try next */ }
  }

  // Wait for login to complete (up to 30s)
  const deadline = Date.now() + SKYSLOPE_LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isSkySlapeLoggedIn(page)) {
      return true;
    }
    await page.waitForTimeout(FAST_POLL_MS);
  }

  return false;
}

async function tryClickSignIn(page: Page): Promise<boolean> {
  const candidates = [
    page.getByRole('link', { name: /sign in/i }).first(),
    page.getByRole('link', { name: /log in/i }).first(),
    page.getByRole('button', { name: /sign in/i }).first(),
    page.locator('a[href*="login"], a[href*="signin"]').first(),
  ];

  for (const candidate of candidates) {
    try {
      await candidate.waitFor({ state: 'visible', timeout: 2000 });
      await candidate.click();
      return true;
    } catch { /* try next */ }
  }
  return false;
}

async function tryClickButton(page: Page, labels: string[]): Promise<boolean> {
  for (const label of labels) {
    const candidates = [
      page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first(),
      page.locator(`input[type="submit"][value="${label}"]`).first(),
      page.getByRole('button', { name: new RegExp(label, 'i') }).first(),
    ];
    for (const candidate of candidates) {
      try {
        await candidate.waitFor({ state: 'visible', timeout: 2000 });
        await candidate.click();
        return true;
      } catch { /* try next */ }
    }
  }
  return false;
}

async function dismissCookieConsent(page: Page): Promise<void> {
  // OneTrust and similar cookie consent overlays block pointer events.
  // Try to dismiss them by clicking Accept/Close buttons or removing the overlay.
  const dismissed = await page.evaluate(`
    (() => {
      // Try clicking common consent buttons
      var acceptBtns = document.querySelectorAll(
        '#onetrust-accept-btn-handler, .onetrust-close-btn-handler, ' +
        'button[id*="accept"], button[class*="accept"], ' +
        '.cookie-consent-accept, #accept-cookies'
      );
      for (var i = 0; i < acceptBtns.length; i++) {
        acceptBtns[i].click();
        return 'clicked';
      }

      // If no button found, remove the overlay elements directly
      var overlays = document.querySelectorAll(
        '#onetrust-consent-sdk, .onetrust-pc-dark-filter, ' +
        '#onetrust-banner-sdk, .cookie-consent-overlay'
      );
      for (var j = 0; j < overlays.length; j++) {
        overlays[j].remove();
      }
      return overlays.length > 0 ? 'removed' : 'none';
    })()
  `) as string;

  if (dismissed !== 'none') {
    console.log(`[Step 5] Cookie consent dismissed (${dismissed}).`);
    await page.waitForTimeout(UI_SETTLE_MS);
  }
}

async function waitForLoginSurface(page: Page): Promise<void> {
  await Promise.race([
    page.locator(skyslopeSelectors.loginEmailInput).first().waitFor({ state: 'visible', timeout: 5_000 }),
    page.locator('input[type="email"]').first().waitFor({ state: 'visible', timeout: 5_000 }),
    page.locator(skyslopeSelectors.postLoginIndicator).first().waitFor({ state: 'visible', timeout: 5_000 }),
  ]).catch(() => {});
}

async function waitForPasswordSurface(page: Page): Promise<void> {
  await Promise.race([
    page.locator(skyslopeSelectors.loginPasswordInput).first().waitFor({ state: 'visible', timeout: 6_000 }),
    page.locator('input[name="password"]').first().waitFor({ state: 'visible', timeout: 6_000 }),
    page.locator('input[type="password"]').first().waitFor({ state: 'visible', timeout: 6_000 }),
    page.locator(skyslopeSelectors.postLoginIndicator).first().waitFor({ state: 'visible', timeout: 6_000 }),
  ]).catch(() => {});
}
