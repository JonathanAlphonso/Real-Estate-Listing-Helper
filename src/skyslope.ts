import type { Page, Locator } from 'playwright';
import { skyslopeSelectors } from '../config/selectors/skyslope.js';
import { takeScreenshot } from './browser.js';

export type SkySlopeFormId = '271' | '290';

const FORM_CARD_SELECTORS: Record<SkySlopeFormId, string> = {
  '271': skyslopeSelectors.form271Card,
  '290': skyslopeSelectors.form290Card,
};

export async function continueFromAddFormsIfNeeded(page: Page): Promise<void> {
  if (!page.url().includes('/add-forms')) {
    return;
  }

  const nextButton = page.locator(skyslopeSelectors.addFormsNextButton).first();
  await nextButton.waitFor({ state: 'visible', timeout: 15_000 });
  await Promise.all([
    page.waitForURL(/\/file\/.*\/documents/, { timeout: 20_000 }),
    nextButton.click(),
  ]);
}

export async function ensureDocumentsPage(page: Page, fileUrl?: string): Promise<string> {
  await assertNoServerError(page, 'while trying to reach the documents page');

  if (page.url().includes('/documents')) {
    return page.url();
  }

  await continueFromAddFormsIfNeeded(page);
  if (page.url().includes('/documents')) {
    return page.url();
  }

  if (fileUrl) {
    const documentsUrl = toDocumentsUrl(fileUrl);
    await page.goto(documentsUrl, { waitUntil: 'domcontentloaded' });
    await assertNoServerError(page, 'after navigating to the documents page');
    if (page.url().includes('/documents')) {
      return page.url();
    }
  }

  throw new Error(`Expected the SkySlope documents page, but found: ${page.url()}`);
}

export async function openFormEditor(page: Page, formId: SkySlopeFormId, fileUrl?: string): Promise<string> {
  const documentsUrl = await ensureDocumentsPage(page, fileUrl);
  const card = page.locator(FORM_CARD_SELECTORS[formId]).first();
  await card.waitFor({ state: 'visible', timeout: 20_000 });
  await card.scrollIntoViewIfNeeded();

  if (!await tryOpenEditorFromCard(page, card)) {
    await assertNoServerError(page, `while opening SkySlope form ${formId}`);
    throw new Error(`Could not open SkySlope form ${formId} from the documents page.`);
  }
  await waitForEditor(page);

  return documentsUrl;
}

function toDocumentsUrl(fileUrl: string): string {
  if (fileUrl.includes('/documents')) {
    return fileUrl;
  }

  if (fileUrl.includes('/add-forms')) {
    return fileUrl.replace('/add-forms', '/documents');
  }

  const match = fileUrl.match(/\/file\/(\d+)/);
  if (match) {
    return `https://forms.skyslope.com/file/${match[1]}/documents`;
  }

  return fileUrl;
}

async function tryOpenEditorFromCard(page: Page, card: Locator): Promise<boolean> {
  const directOpen = await waitForEditorUrl(page, async () => {
    await clickFormCard(card);
  });
  if (directOpen) {
    return true;
  }

  const fillAndSend = page.getByRole('button', { name: /fill and send/i }).first();
  const fillAndSendVisible = await fillAndSend.isVisible().catch(() => false);
  if (fillAndSendVisible) {
    const openedFromActionBar = await waitForEditorUrl(page, async () => {
      await fillAndSend.click();
    });
    if (openedFromActionBar) {
      return true;
    }
  }

  const openedFromKeyboard = await waitForEditorUrl(page, async () => {
    await card.focus().catch(() => {});
    await card.press('Enter');
  });
  return openedFromKeyboard;
}

async function waitForEditorUrl(page: Page, action: () => Promise<void>): Promise<boolean> {
  try {
    await Promise.all([
      page.waitForURL(/\/fill\/envelope\//, { timeout: 8_000 }),
      action(),
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function leaveEditorWithoutSaving(page: Page, documentsUrl: string): Promise<void> {
  await page.goto(documentsUrl, { waitUntil: 'domcontentloaded' });
  await ensureDocumentsPage(page);
}

export async function saveAndExitForm(page: Page): Promise<void> {
  await assertNoServerError(page, 'before Save & Exit');

  const saveButton = page.locator(skyslopeSelectors.saveAndExitButton).first();
  try {
    await saveButton.waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    await assertNoServerError(page, 'while locating Save & Exit');
    throw new Error(`Save & Exit button not found. Current URL: ${page.url()}`);
  }

  await saveButton.evaluate((el) => el.scrollIntoView({ block: 'center' }));

  await saveButton.evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });

  try {
    await page.waitForURL(/\/file\/.*\/documents/, { timeout: 20_000 });
  } catch (error) {
    await assertNoServerError(page, 'after Save & Exit');
    await takeScreenshot(page, 'skyslope-save-failed').catch(() => {});
    throw new Error(`Save & Exit did not return to the documents page. Current URL: ${page.url()}`, {
      cause: error,
    });
  }
}

async function isServerErrorPage(page: Page): Promise<boolean> {
  const bodyText = await page.locator('body').textContent({ timeout: 2000 }).catch(() => '');
  return (bodyText ?? '').includes("That's not supposed to happen")
    || (bodyText ?? '').includes('server encountered a temporary error');
}

async function assertNoServerError(page: Page, stage: string): Promise<void> {
  if (!await isServerErrorPage(page)) {
    return;
  }

  const screenshotName = `skyslope-server-error-${stage.replace(/[^\w]+/g, '-').toLowerCase()}`;
  await takeScreenshot(page, screenshotName).catch(() => {});
  throw new Error(`SkySlope server error detected ${stage}. Current URL: ${page.url()}`);
}

export async function setControlledFieldValue(field: Locator, value: string): Promise<void> {
  await field.waitFor({ state: 'visible', timeout: 10_000 });
  await field.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));

  await field.evaluate((el, nextValue) => {
    const prototype = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    nativeSetter?.call(el, nextValue);

    el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    el.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: nextValue,
      inputType: 'insertText',
    }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  }, value);
}

async function waitForEditor(page: Page): Promise<void> {
  if (!page.url().includes('/fill/envelope/')) {
    throw new Error(`Expected the SkySlope editor, but found: ${page.url()}`);
  }

  try {
    await page.locator(skyslopeSelectors.editorIndicator).first().waitFor({
      state: 'visible',
      timeout: 20_000,
    });
  } catch (error) {
    await assertNoServerError(page, 'while waiting for the editor to load');
    throw error;
  }
}

async function clickFormCard(card: Locator): Promise<void> {
  const directTargets = [
    card,
    card.getByRole('link').first(),
    card.locator('img').first(),
    card.locator('text=/./').first(),
    card.locator('button:not([aria-label*="document actions" i]):not([aria-label="document actions"])').first(),
  ];

  for (let index = 0; index < directTargets.length; index++) {
    const target = directTargets[index]!;
    try {
      if (index === 0) {
        await target.click({ timeout: 5_000, position: { x: 40, y: 60 } });
      } else {
        await target.click({ timeout: 5_000 });
      }
      return;
    } catch {
      // Try the next interactive target.
    }
  }

  throw new Error('Could not open the SkySlope form card.');
}
