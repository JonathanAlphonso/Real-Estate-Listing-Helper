import type { Page } from 'playwright';
import type { WorkflowContext } from '../types/workflow-state.js';
import { skyslopeSelectors } from '../../config/selectors/skyslope.js';
import { fieldMappings } from '../../config/field-mappings.js';
import { readAllData } from '../spreadsheet.js';
import { takeScreenshot } from '../browser.js';
import {
  leaveEditorWithoutSaving,
  openFormEditor,
  saveAndExitForm,
  setControlledFieldValue,
} from '../skyslope.js';
import { resolveSkySlopeFieldValue } from '../skyslope-data.js';

const FIELD_SETTLE_MS = 75;

export async function run(ctx: WorkflowContext): Promise<void> {
  console.log('[Step 7] Filling SkySlope forms from spreadsheet data...');

  const page = ctx.page;
  const data = await readAllData(ctx.spreadsheetPath);
  const skyslopeFileUrl = data[fieldMappings.skyslopeFileUrl.spreadsheetColumn];

  if (ctx.debug) {
    console.log('[DEBUG] Spreadsheet data loaded:', data);
    await page.pause();
  }

  if (hasForm271CandidateData(data)) {
    console.log('[Step 7] Filling Form 271 (Listing Agreement)...');
    const documentsUrl = await openFormEditor(page, '271', skyslopeFileUrl);
    const form271Result = await fillForm271(page, data);

    if (form271Result.filled === 0 && !form271Result.verified) {
      await leaveEditorWithoutSaving(page, documentsUrl);
      throw new Error('Form 271 opened successfully, but no mapped fields were filled.');
    }

    if (form271Result.filled > 0) {
      await saveAndExitForm(page);
    } else {
      await leaveEditorWithoutSaving(page, documentsUrl);
    }

    console.log(
      `[Step 7] Form 271: ${form271Result.filled} fields filled, ${form271Result.skipped} skipped, verification ${form271Result.verified ? 'passed' : 'failed'}.`
    );
  } else {
    console.log('[Step 7] Skipping Form 271 because no mapped CSV values were available.');
  }

  console.log('[Step 7] Filling Form 290 (MLS Data Info)...');
  const documentsUrl = await openFormEditor(page, '290', skyslopeFileUrl);
  const form290Result = await fillForm290(page, data);

  if (form290Result.filled === 0) {
    await leaveEditorWithoutSaving(page, documentsUrl);
    throw new Error('Form 290 opened successfully, but no fields were filled.');
  }

  console.log(
    `[Step 7] Form 290: ${form290Result.filled} fields filled, ${form290Result.skipped} skipped, ${form290Result.defaultsUsed} defaults used.`
  );
  await saveAndExitForm(page);

  await takeScreenshot(page, 'skyslope-filled');
  console.log('[Step 7] Form filling complete.');
}

async function fillForm271(
  page: Page,
  data: Record<string, string>,
): Promise<{ filled: number; skipped: number; verified: boolean }> {
  const formSelectors = skyslopeSelectors.form271 as Record<string, string>;
  let filled = 0;
  let skipped = 0;

  for (const [fieldName, mapping] of Object.entries(fieldMappings)) {
    const selectorKey = mapping.form271Selector;
    if (!selectorKey) continue;

    const value = data[mapping.spreadsheetColumn];
    if (!value) continue;

    const selector = formSelectors[selectorKey];
    if (!selector) continue;

    try {
      const element = await locateForm271Field(page, selectorKey, selector);
      await element.waitFor({ state: 'visible', timeout: 5000 });
      await element.fill(value);
      await element.evaluate((el) => el.blur());
      console.log(`  [OK] 271.${fieldName}: "${value}"`);
      filled++;
    } catch {
      console.warn(`  [SKIP] 271.${fieldName}: selector not found or timed out`);
      skipped++;
    }
  }

  return { filled, skipped, verified: await verifyForm271Prepopulation(page, data) };
}

async function fillForm290(
  page: Page,
  data: Record<string, string>,
): Promise<{ filled: number; skipped: number; defaultsUsed: number }> {
  const textSelectors = skyslopeSelectors.form290Text as Record<string, string>;
  const checkboxMappings = skyslopeSelectors.form290Checkboxes as Record<
    string,
    Record<string, string>
  >;

  let filled = 0;
  let skipped = 0;
  let defaultsUsed = 0;

  for (const [fieldName, mapping] of Object.entries(fieldMappings)) {
    const selectorKey = mapping.form290Selector;
    if (!selectorKey) continue;

    const resolution = resolveSkySlopeFieldValue(fieldName, data);
    if (!resolution.value) continue;

    const fieldType = mapping.form290Type ?? 'text';

    // Check if the server has crashed before attempting each field
    const bodyText = await page.locator('body').textContent({ timeout: 2000 }).catch(() => '');
    if ((bodyText ?? '').includes("That's not supposed to happen")) {
      console.warn(`  [ABORT] SkySlope server error detected. Stopping fill at ${filled} fields.`);
      break;
    }

    try {
      const didFill = fieldType === 'text'
        ? await fillTextField(page, fieldName, selectorKey, resolution.value, textSelectors)
        : await fillCheckboxField(page, fieldName, selectorKey, resolution.value, checkboxMappings);

      if (didFill) {
        filled++;
        if (resolution.source === 'default') {
          defaultsUsed++;
          console.log(`  [DEFAULT] 290.${fieldName}: "${resolution.value}"`);
        } else if (resolution.source === 'derived') {
          console.log(`  [DERIVED] 290.${fieldName}: "${resolution.value}"`);
        }
      } else {
        skipped++;
      }
    } catch {
      console.warn(`  [SKIP] 290.${fieldName}: could not fill "${resolution.value}"`);
      skipped++;
    }

    // Brief pause between fields to avoid overwhelming the PropTx editor
    await page.waitForTimeout(FIELD_SETTLE_MS);
  }

  return { filled, skipped, defaultsUsed };
}

async function fillTextField(
  page: Page,
  fieldName: string,
  selectorKey: string,
  value: string,
  textSelectors: Record<string, string>,
): Promise<boolean> {
  const selector = textSelectors[selectorKey];
  if (!selector) {
    throw new Error(`No text selector for key "${selectorKey}"`);
  }

  const element = page.locator(selector).first();
  await setControlledFieldValue(element, value);

  console.log(`  [OK] 290.${fieldName}: "${value}"`);
  return true;
}

async function fillCheckboxField(
  page: Page,
  fieldName: string,
  selectorKey: string,
  rawValue: string,
  checkboxMappings: Record<string, Record<string, string>>,
): Promise<boolean> {
  const optionMap = checkboxMappings[selectorKey];
  if (!optionMap) {
    throw new Error(`No checkbox mapping for key "${selectorKey}"`);
  }

  const normalized = rawValue.trim().toLowerCase();
  const normalizedNoHyphen = normalized.replace(/-/g, ' ');
  let selector = optionMap[normalized] || optionMap[normalizedNoHyphen];

  if (!selector) {
    for (const [optionKey, optionSelector] of Object.entries(optionMap)) {
      const keyNorm = optionKey.replace(/-/g, ' ');
      if (keyNorm.startsWith(normalizedNoHyphen) || normalizedNoHyphen.startsWith(keyNorm)
        || keyNorm === normalizedNoHyphen) {
        selector = optionSelector;
        break;
      }
    }
  }

  if (!selector) {
    const options = Object.keys(optionMap).join(', ');
    console.warn(`  [SKIP] 290.${fieldName}: no checkbox match for "${rawValue}" (options: ${options})`);
    return false;
  }

  const element = page.locator(selector).first();
  await element.scrollIntoViewIfNeeded({ timeout: 5000 });
  await element.waitFor({ state: 'visible', timeout: 5000 });

  if (!await element.isChecked()) {
    await element.check();
  }

  console.log(`  [OK] 290.${fieldName}: checked "${rawValue}"`);
  return true;
}

function hasForm271CandidateData(data: Record<string, string>): boolean {
  return Object.values(fieldMappings).some((mapping) => {
    if (!mapping.form271Selector) {
      return false;
    }

    return Boolean(data[mapping.spreadsheetColumn]);
  });
}

async function verifyForm271Prepopulation(page: Page, data: Record<string, string>): Promise<boolean> {
  const bodyText = (((await page.locator('body').textContent().catch(() => '')) || '').replace(/\s+/g, ' ')).toLowerCase();
  const sellerName = normalizeForMatch(data[fieldMappings.sellerName.spreadsheetColumn] || '');
  const address = data[fieldMappings.address.spreadsheetColumn] || '';
  const parsedAddress = address.split(',').map((part) => normalizeForMatch(part)).filter(Boolean);

  const sellerVerified = !sellerName || bodyText.includes(sellerName);
  const addressVerified = parsedAddress.every((part) => bodyText.includes(part));
  return sellerVerified && addressVerified;
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function locateForm271Field(
  page: Page,
  selectorKey: string,
  selector: string,
): Promise<ReturnType<Page['locator']>> {
  const candidates = [
    page.locator(selector).first(),
    ...getForm271FallbackLocators(page, selectorKey),
  ];

  for (const candidate of candidates) {
    try {
      if (await candidate.isVisible({ timeout: 1500 })) {
        return candidate;
      }
    } catch {
      // Try the next candidate.
    }
  }

  return page.locator(selector).first();
}

function getForm271FallbackLocators(page: Page, selectorKey: string): Array<ReturnType<Page['locator']>> {
  const labelHints: Record<string, string[]> = {
    sellerName: ['Seller Name', 'Seller', 'Owner'],
    propertyAddress: ['Property Address', 'Address'],
    legalDescription: ['Legal Description', 'Legal Desc'],
    listPrice: ['List Price', 'Price'],
  };

  const hints = labelHints[selectorKey] ?? [];
  return hints.flatMap((hint) => [
    page.getByLabel(new RegExp(hint, 'i')).first(),
    page.locator(`input[aria-label*="${hint}" i], textarea[aria-label*="${hint}" i]`).first(),
    page.locator(`input[placeholder*="${hint}" i], textarea[placeholder*="${hint}" i]`).first(),
  ]);
}
