import type { WorkflowContext } from '../types/workflow-state.js';
import { urls } from '../../config/urls.js';
import { realmSelectors } from '../../config/selectors/realm.js';
import { takeScreenshot, saveAuthState } from '../browser.js';

const PAGE_PROGRESS_TIMEOUT_MS = 30_000;
const PROPTX_LOGIN_TIMEOUT_MS = 180_000; // 3 minutes to allow manual SMS 2FA completion

export async function run(ctx: WorkflowContext): Promise<void> {
  console.log('[Step 1] Opening PropTx portal...');

  // Navigate to Realm directly. If SSO cookies are valid, we stay on Realm.
  // If expired, the app JS-redirects to sso.ampre.ca for login.
  // IMPORTANT: app.realmmlp.ca renders the full React shell (with dashboard text)
  // before the JS redirect fires, so we must wait for the redirect to complete
  // before checking session state.
  await ctx.page.goto(urls.realm, { waitUntil: 'domcontentloaded', timeout: PAGE_PROGRESS_TIMEOUT_MS });

  // Wait for the JS redirect to either fire (→ SSO) or not (→ dashboard stays loaded)
  const loggedIn = await waitForLoginOutcome(ctx.page);

  if (loggedIn) {
    console.log('[Step 1] PropTx session active (SSO auto-redirected). No login needed.');
    await saveAuthState();
    return;
  }

  console.log(`[Step 1] SSO session expired. Current URL: ${ctx.page.url()}`);

  // SSO session expired — try auto-filling credentials from .env
  const username = process.env.PROPTX_USERNAME;
  const password = process.env.PROPTX_PASSWORD;

  if (username && password) {
    console.log(`[Step 1] Auto-filling PropTx credentials for ${username}...`);
    await attemptAutoFill(ctx.page, username, password);
  }

  // Wait for login to complete after auto-fill only.
  await waitForPortalSession(ctx.page);

  // Save auth state so the next run can skip login
  await saveAuthState();
  console.log('[Step 1] Portal login complete.');
}

async function attemptAutoFill(page: WorkflowContext['page'], username: string, password: string): Promise<void> {
  await enterMemberFlow(page);

  // PropTx login form has "ENTER YOUR USER ID" and "PIN" labels
  // with generic input fields (no name/type attributes).
  // Also handle standard SSO forms (Okta, etc.) as fallback.
  const usernameSelectors = [
    // PropTx-specific: first visible text input on the page
    'input[type="text"]',
    'input[name="username"]',
    'input[name="identifier"]',
    'input[type="email"]',
    'input[name="email"]',
    'input[id="username"]',
    'input[id="email"]',
  ];

  let usernameFilled = false;
  for (const selector of usernameSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 3000 })) {
        await el.click();
        await el.fill(username);
        console.log('[Step 1] Filled username/User ID field.');
        usernameFilled = true;
        break;
      }
    } catch { /* try next */ }
  }

  if (!usernameFilled) {
    // Last resort: find input near "User ID" text
    try {
      const label = page.getByText('User ID', { exact: false }).first();
      const input = label.locator('xpath=following::input[1]').first();
      if (await input.isVisible({ timeout: 2000 })) {
        await input.fill(username);
        console.log('[Step 1] Filled User ID field (by label).');
        usernameFilled = true;
      }
    } catch { /* continue */ }
  }

  // Fill PIN/password field
  let passwordFilled = false;
  const passwordSelectors = [
    'input[type="password"]',
    'input[name="password"]',
    'input[name="credentials.passcode"]',
    'input[id="password"]',
  ];

  for (const selector of passwordSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 3000 })) {
        await el.click();
        await el.fill(password);
        console.log('[Step 1] Filled PIN/password field.');
        passwordFilled = true;
        break;
      }
    } catch { /* try next */ }
  }

  if (!usernameFilled || !passwordFilled) {
    await takeScreenshot(page, 'proptx-login-form-incomplete').catch(() => {});
    throw new Error(`Could not fully auto-fill the PropTx login form. Current URL: ${page.url()}`);
  }

  // Click Submit/Sign in
  const submitted = await tryClickButton(page, ['Submit', 'Sign in', 'Log in', 'Next', 'Verify']);
  if (!submitted) {
    await takeScreenshot(page, 'proptx-submit-missing').catch(() => {});
    throw new Error(`Could not submit the PropTx login form automatically. Current URL: ${page.url()}`);
  }

  // Give the form submission time to process (may redirect to 2FA page)
  await page.waitForTimeout(5000);
}

async function tryClickButton(page: WorkflowContext['page'], labels: string[]): Promise<boolean> {
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

async function waitForPortalSession(page: WorkflowContext['page'], timeoutMs = PROPTX_LOGIN_TIMEOUT_MS): Promise<void> {
  console.log('[Step 1] Waiting for PropTx login automation to complete...');

  let twoFactorNotified = false;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await enterMemberFlow(page);

    if (await hasPortalSession(page)) {
      console.log('[OK] PropTx session detected. Continuing...\n');
      return;
    }

    const bodyText = ((await page.locator('body').textContent({ timeout: 1000 }).catch(() => '')) ?? '')
      .replace(/\s+/g, ' ')
      .toLowerCase();

    // Hard failures — credentials rejected
    if (bodyText.includes('invalid user id') || bodyText.includes('invalid pin')) {
      await takeScreenshot(page, 'proptx-login-rejected').catch(() => {});
      throw new Error(`PropTx login was rejected (invalid credentials). Current URL: ${page.url()}`);
    }

    // 2FA page — wait for the user to complete it manually
    const on2fa = bodyText.includes('one-time code') || bodyText.includes('verification code')
      || bodyText.includes('enter the code') || bodyText.includes('two-factor')
      || page.url().includes('sso.ampre.ca');
    if (on2fa) {
      if (!twoFactorNotified) {
        console.log('[Step 1] 2FA / SMS verification detected. Please complete it in the browser...');
        twoFactorNotified = true;
      }
    }

    await page.waitForTimeout(1000);
  }

  await takeScreenshot(page, 'portal-login-timeout');
  throw new Error(`Timed out waiting for PropTx login automation. Last URL: ${page.url()}`);
}

async function waitForLoginOutcome(page: WorkflowContext['page']): Promise<boolean> {
  // The Realm app at app.realmmlp.ca renders the full React shell immediately
  // (including dashboard text like "My Market Areas"), then the OAuth check runs
  // and JS-redirects to sso.ampre.ca if the session is expired. We MUST wait for
  // that redirect to fire (or not) before deciding.
  //
  // Strategy: wait up to 10s for the URL to leave app.realmmlp.ca.
  // If it stays on Realm → logged in. If it goes to SSO → need login.
  const initialUrl = page.url();

  try {
    // Wait for URL to change away from the initial Realm page
    await page.waitForURL((url) => {
      const href = url.href.toLowerCase();
      // URL changed to SSO → session expired
      if (href.includes('sso.ampre.ca')) return true;
      // URL changed to a Realm sub-page (dashboard, search) → session valid
      if (href.includes('app.realmmlp.ca/') && href !== initialUrl.toLowerCase()
          && !href.endsWith('app.realmmlp.ca/')) return true;
      return false;
    }, { timeout: 10_000 });
  } catch {
    // URL didn't change in 10s — either we're legitimately logged in on the root
    // page, or the redirect is very slow. Check for login form as final arbiter.
  }

  const finalUrl = page.url().toLowerCase();

  // Definitive: SSO login page
  if (finalUrl.includes('sso.ampre.ca') || finalUrl.includes('/signin')) {
    return false;
  }

  // Check for login form (in case we're on a login page without sso.ampre.ca URL)
  const hasLoginForm = await page.locator('input[type="password"]').first()
    .isVisible({ timeout: 2000 }).catch(() => false);
  if (hasLoginForm) {
    return false;
  }

  const signInAsVisible = await page.getByText('Sign in As', { exact: false }).first()
    .isVisible({ timeout: 2000 }).catch(() => false);
  if (signInAsVisible) {
    return false;
  }

  // If we're still on Realm after 10s with no login form, we're logged in
  return true;
}

async function hasPortalSession(page: WorkflowContext['page']): Promise<boolean> {
  const url = page.url().toLowerCase();

  // Exclude SSO login pages
  if (url.includes('sso.ampre.ca')) {
    return false;
  }

  if (url.includes('/signin')) {
    return false;
  }

  // Known logged-in URLs — but for Realm, require visible dashboard content,
  // not just the URL, because app.realmmlp.ca may briefly appear before
  // client-side redirect to SSO when the session is expired.
  if (url.includes('ontariomlp.ca/')) {
    return true;
  }

  // Check for post-login UI elements
  const selectorDetected = await page.waitForSelector(realmSelectors.postLoginIndicator, {
    state: 'visible',
    timeout: 1000,
  }).then(() => true).catch(() => false);

  if (selectorDetected) {
    return true;
  }

  // Check body text for known PropTx/Realm logged-in markers
  const bodyText = ((await page.locator('body').textContent({ timeout: 1000 }).catch(() => '')) ?? '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

  return bodyText.includes('proptx member')
    || bodyText.includes('search properties')
    || bodyText.includes('geowarehouse')
    || bodyText.includes('recent searches')
    || bodyText.includes('my market areas')
    || bodyText.includes('search realm');
}

async function enterMemberFlow(page: WorkflowContext['page']): Promise<void> {
  const url = page.url().toLowerCase();
  const onChooser = url.includes('/signin')
    || await page.getByText('Sign in As', { exact: false }).first()
      .isVisible({ timeout: 1000 }).catch(() => false);

  if (!onChooser) {
    return;
  }

  // The Realm chooser renders an unlabeled icon button beside a separate "Member"
  // label. Broad text locators can land on the client flow instead of PropTx.
  const candidates = [
    page.locator(realmSelectors.memberAccessButton).first(),
    page.locator('button:near(p:text-is("Member"))').first(),
  ];

  let clicked = false;
  for (const candidate of candidates) {
    try {
      await candidate.waitFor({ state: 'visible', timeout: 3000 });
      await candidate.click();
      clicked = true;
      break;
    } catch {
      // Try the next candidate
    }
  }

  if (!clicked) {
    return;
  }

  try {
    await page.waitForURL((url) => {
      const href = url.href.toLowerCase();
      return href.includes('sso.ampre.ca') || !href.includes('/signin');
    }, { timeout: PAGE_PROGRESS_TIMEOUT_MS });
  } catch (error) {
    const clientSignInVisible = await page.getByRole('button', { name: /sign in as someone else/i })
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    if (clientSignInVisible) {
      await takeScreenshot(page, 'realm-member-flow-client-signin').catch(() => {});
      throw new Error(`Realm member chooser opened the client login flow instead of PropTx. Current URL: ${page.url()}`);
    }
    await takeScreenshot(page, 'realm-member-flow-timeout').catch(() => {});
    throw new Error(`Realm sign-in chooser did not progress within ${PAGE_PROGRESS_TIMEOUT_MS / 1000}s after clicking Member. Current URL: ${page.url()}`, {
      cause: error,
    });
  }
}
