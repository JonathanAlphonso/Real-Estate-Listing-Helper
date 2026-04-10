import type { WorkflowContext } from '../types/workflow-state.js';
import { skyslopeSelectors } from '../../config/selectors/skyslope.js';
import { takeScreenshot } from '../browser.js';

export async function run(ctx: WorkflowContext): Promise<void> {
  console.log('[Step 6] Creating new transaction and adding forms in SkySlope...');

  const page = ctx.page;
  const s = skyslopeSelectors;

  if (ctx.debug) {
    console.log('[DEBUG] Pausing for selector discovery on SkySlope...');
    await page.pause();
  }

  // Create new transaction
  console.log('[Step 6] Creating new listing transaction...');
  const newButton = page.locator(s.newTransactionButton).first();
  await newButton.waitFor({ state: 'visible', timeout: 15000 });
  await newButton.click();
  await page.waitForTimeout(2000);

  // Select transaction type (Listing)
  try {
    const typeSelect = page.locator(s.transactionTypeSelect).first();
    await typeSelect.waitFor({ state: 'visible', timeout: 5000 });
    await typeSelect.selectOption({ label: 'Listing' });
  } catch {
    // Some versions may use a different UI for type selection
    const listingOption = page.locator(s.transactionTypeListing).first();
    await listingOption.click().catch(() => {
      console.log('[Step 6] Could not auto-select transaction type. May need manual selection.');
    });
  }
  await page.waitForTimeout(1000);

  // Enter property address
  const addressInput = page.locator(s.propertyAddressInput).first();
  await addressInput.waitFor({ state: 'visible', timeout: 10000 });
  await addressInput.fill(ctx.address);
  await page.waitForTimeout(1000);

  // Submit transaction creation
  const submitButton = page.locator(s.createTransactionSubmit).first();
  await submitButton.click();
  await page.waitForTimeout(3000);

  // Add Form 271 (Listing Agreement)
  console.log('[Step 6] Adding Form 271 (Listing Agreement)...');
  await addForm(page, s, '271');

  // Add Form 290 (MLS Data Info)
  console.log('[Step 6] Adding Form 290 (MLS Data Info)...');
  await addForm(page, s, '290');

  await takeScreenshot(page, 'skyslope-forms-added');
  console.log('[Step 6] Transaction created and forms added.');
}

async function addForm(
  page: import('playwright').Page,
  s: typeof skyslopeSelectors,
  formNumber: string
): Promise<void> {
  // Click "Add Form" button
  const addButton = page.locator(s.addFormButton).first();
  await addButton.waitFor({ state: 'visible', timeout: 10000 });
  await addButton.click();
  await page.waitForTimeout(1500);

  // Search for the form
  const searchInput = page.locator(s.formSearchInput).first();
  await searchInput.waitFor({ state: 'visible', timeout: 10000 });
  await searchInput.fill(formNumber);
  await page.waitForTimeout(1500);

  // Select the form from results
  const formOption = formNumber === '271'
    ? page.locator(s.form271Option).first()
    : page.locator(s.form290Option).first();
  await formOption.click();
  await page.waitForTimeout(1000);

  // Confirm adding the form
  const addSelected = page.locator(s.addSelectedFormButton).first();
  await addSelected.click();
  await page.waitForTimeout(2000);

  console.log(`[Step 6] Form ${formNumber} added.`);
}
