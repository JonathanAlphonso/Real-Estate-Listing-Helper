import type { WorkflowContext } from '../types/workflow-state.js';
import { skyslopeSelectors } from '../../config/selectors/skyslope.js';
import { fieldMappings } from '../../config/field-mappings.js';
import { readAllData } from '../spreadsheet.js';
import { takeScreenshot } from '../browser.js';

export async function run(ctx: WorkflowContext): Promise<void> {
  console.log('[Step 7] Filling SkySlope forms from spreadsheet data...');

  const page = ctx.page;
  const data = await readAllData(ctx.spreadsheetPath);

  if (ctx.debug) {
    console.log('[DEBUG] Spreadsheet data loaded:', data);
    await page.pause();
  }

  // Fill Form 271 fields
  console.log('[Step 7] Filling Form 271 (Listing Agreement)...');
  await fillFormFields(page, data, 'form271');

  // Fill Form 290 fields
  console.log('[Step 7] Filling Form 290 (MLS Data Info)...');
  await fillFormFields(page, data, 'form290');

  await takeScreenshot(page, 'skyslope-filled');
  console.log('[Step 7] Form filling complete.');
}

async function fillFormFields(
  page: import('playwright').Page,
  data: Record<string, string>,
  formKey: 'form271' | 'form290'
): Promise<void> {
  const formSelectors = skyslopeSelectors[formKey] as Record<string, string>;

  for (const [fieldName, mapping] of Object.entries(fieldMappings)) {
    const selectorKey = formKey === 'form271' ? mapping.form271Selector : mapping.form290Selector;

    if (!selectorKey) continue;

    const value = data[mapping.spreadsheetColumn];
    if (!value) continue;

    const selector = formSelectors[selectorKey];
    if (!selector) continue;

    try {
      const element = page.locator(selector).first();
      await element.waitFor({ state: 'visible', timeout: 5000 });

      // Determine input type and fill accordingly
      const tagName = await element.evaluate((el) => el.tagName.toLowerCase());
      const inputType = await element.evaluate((el) =>
        el instanceof HTMLInputElement ? el.type : ''
      );

      if (tagName === 'select') {
        await element.selectOption({ label: value });
      } else if (tagName === 'textarea') {
        await element.fill(value);
      } else if (inputType === 'checkbox') {
        const shouldCheck = ['true', 'yes', '1'].includes(value.toLowerCase());
        if (shouldCheck) await element.check();
      } else {
        await element.fill(value);
      }

      console.log(`  [OK] ${fieldName}: "${value}"`);
    } catch {
      console.warn(`  [SKIP] ${fieldName}: could not fill (selector not found or timed out)`);
    }
  }
}
