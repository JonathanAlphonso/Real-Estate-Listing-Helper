import type { Page } from 'playwright';
import type { WorkflowContext } from '../types/workflow-state.js';
import { skyslopeSelectors } from '../../config/selectors/skyslope.js';
import { takeScreenshot } from '../browser.js';
import { continueFromAddFormsIfNeeded, ensureDocumentsPage } from '../skyslope.js';
import { readAllData, writePropertyData } from '../spreadsheet.js';
import {
  inferCounty,
  parseAddressForSkySlope,
  parsePrimaryContact,
  parseRegisteredOwners,
} from '../skyslope-data.js';
import { fieldMappings } from '../../config/field-mappings.js';

const UI_SETTLE_MS = 100;
const FORM_SEARCH_SETTLE_MS = 350;

export async function run(ctx: WorkflowContext): Promise<void> {
  console.log('[Step 6] Creating new transaction and adding forms in SkySlope...');

  const page = ctx.page;
  const s = skyslopeSelectors;
  const csvData = await readAllData(ctx.spreadsheetPath);

  if (ctx.debug) {
    console.log('[DEBUG] Pausing for selector discovery on SkySlope...');
    await page.pause();
  }

  // Navigate to Create page
  console.log('[Step 6] Navigating to Create page...');
  const createBtn = page.locator(s.newTransactionButton).first();
  await createBtn.waitFor({ state: 'visible', timeout: 15000 });
  await createBtn.click();
  await page.locator(s.createFileHeading).first().waitFor({ state: 'visible', timeout: 20_000 });

  // Select "Seller" representation type
  console.log('[Step 6] Selecting Seller representation...');
  const sellerRadio = page.locator(s.transactionTypeListing);
  await sellerRadio.check();
  await page.waitForTimeout(UI_SETTLE_MS);

  // Fill primary client info from registered owners
  const ownerNames = ctx.data.geowarehouse?.registeredOwners
    ?? parseRegisteredOwners(csvData[fieldMappings.sellerName.spreadsheetColumn] || csvData['Registered Owners']);
  const contact = parsePrimaryContact(ownerNames[0] || csvData[fieldMappings.sellerName.spreadsheetColumn] || '');
  await fillVisibleRequiredField(page, s.primaryClientFirstNameInput, contact.firstName, 'primary client first name');
  await fillVisibleRequiredField(page, s.primaryClientLastNameInput, contact.lastName, 'primary client last name');
  await fillVisibleRequiredField(
    page,
    s.primaryClientEmailInput,
    csvData[fieldMappings.sellerEmail.spreadsheetColumn] || process.env.SKYSLOPE_CLIENT_EMAIL || '',
    'primary client email',
  );
  await fillVisibleRequiredField(
    page,
    s.propertyCountyInput,
    csvData[fieldMappings.county.spreadsheetColumn]
      || inferCounty(csvData[fieldMappings.city.spreadsheetColumn] || '')
      || process.env.SKYSLOPE_DEFAULT_COUNTY
      || '',
    'county',
  );

  // Parse address components — overlay enriched CSV values over CLI-parsed defaults
  const addressParts = parseAddressForSkySlope(ctx.address);
  const street = addressParts.street;
  const city = csvData[fieldMappings.city.spreadsheetColumn] || addressParts.city;
  const province = csvData[fieldMappings.province.spreadsheetColumn] || addressParts.province;
  const postalCode = csvData[fieldMappings.postalCode.spreadsheetColumn] || addressParts.postalCode;

  // Fill property address
  await page.locator(s.propertyAddressInput).fill(street);
  await page.locator(s.propertyCityInput).fill(city);
  await page.locator(s.propertyProvinceInput).fill(province);
  await page.locator(s.propertyPostalCodeInput).fill(postalCode);
  const baseName = `${street} - Listing (Auto)`;
  await page.locator(s.fileNameInput).fill(baseName);
  console.log(`[Step 6] Address: ${street}, ${city}, ${province} ${postalCode}`);

  await waitForCreateFormReady(page, s);
  await takeScreenshot(page, 'skyslope-create-filled');

  // Submit file creation (retry with suffix if duplicate name)
  console.log('[Step 6] Submitting file creation...');
  let created = false;
  const retryNames = buildRetryFileNames(baseName);
  for (let attempt = 0; attempt < retryNames.length && !created; attempt++) {
    const navPromise = page.waitForURL(/\/file\/.*\/(add-forms|documents)/, { timeout: 15_000 }).then(() => 'navigated' as const);
    const errorPromise = page.locator('text=/already exists|duplicate/i').waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'duplicate' as const);
    await page.locator(s.createTransactionSubmit).click();
    const result = await Promise.race([navPromise, errorPromise]);
    if (result === 'navigated') {
      created = true;
    } else {
      const retryName = retryNames[attempt]!;
      console.log(`[Step 6] File name already exists, retrying as "${retryName}"...`);
      await page.locator(s.fileNameInput).fill(retryName);
      await page.waitForTimeout(UI_SETTLE_MS);
    }
  }
  if (!created) {
    await takeScreenshot(page, 'skyslope-create-duplicate-fail');
    throw new Error('Could not create SkySlope file — name already exists after 3 attempts.');
  }
  console.log(`[Step 6] File created: ${page.url()}`);
  await writePropertyData(ctx.spreadsheetPath, {
    [fieldMappings.skyslopeFileUrl.spreadsheetColumn]: page.url(),
  });

  await takeScreenshot(page, 'skyslope-file-created');

  // Add Form 271 (Listing Agreement)
  console.log('[Step 6] Adding Form 271 (Listing Agreement)...');
  await addForm(page, s, '271');

  // Add Form 290 (MLS Data Info)
  console.log('[Step 6] Adding Form 290 (MLS Data Info)...');
  await addForm(page, s, '290');

  await continueFromAddFormsIfNeeded(page);
  await ensureDocumentsPage(page);

  await takeScreenshot(page, 'skyslope-forms-added');
  console.log('[Step 6] Transaction created and forms added.');
}

async function fillVisibleRequiredField(
  page: Page,
  selector: string,
  value: string,
  label: string,
): Promise<void> {
  const input = page.locator(selector).first();
  const isVisible = await input.isVisible().catch(() => false);

  if (!isVisible) {
    return;
  }

  if (!value.trim()) {
    throw new Error(
      `SkySlope create-file page requires ${label}, but no value was available. Add it to the property CSV or set the matching environment fallback.`,
    );
  }

  await input.fill(value);
  console.log(`[Step 6] ${label}: ${value}`);
}

async function addForm(
  page: Page,
  s: typeof skyslopeSelectors,
  formNumber: string
): Promise<void> {
  if (page.url().includes('/documents')) {
    const addButton = page.locator(s.addFormButton).first();
    await addButton.waitFor({ state: 'visible', timeout: 10_000 });
    await addButton.click();
  } else if (!page.url().includes('/add-forms')) {
    throw new Error(`Expected to add forms from SkySlope add-forms/documents page, but found ${page.url()}`);
  }

  await waitForFormLibraryReady(page, s);

  // Try to search for the form (search input may or may not be present)
  const searchInput = page.locator(s.formSearchInput).first();
  const searchVisible = await searchInput.isVisible().catch(() => false);
  if (searchVisible) {
    await searchInput.fill(formNumber);
    await page.waitForTimeout(FORM_SEARCH_SETTLE_MS);
    console.log(`[Step 6] Searched for "${formNumber}".`);
  } else {
    // Try alternative search inputs (filter input at top of add-forms page)
    const altSearch = page.locator('input[type="text"], input[type="search"], input[placeholder*="search" i], input[placeholder*="filter" i]').first();
    const altVisible = await altSearch.isVisible().catch(() => false);
    if (altVisible) {
      await altSearch.fill(formNumber);
      await page.waitForTimeout(FORM_SEARCH_SETTLE_MS);
      console.log(`[Step 6] Used alternative search for "${formNumber}".`);
    } else {
      console.log(`[Step 6] No search input found — scrolling through form list.`);
    }
  }

  // Strategy 1: Find the form row by title text and click its Add button
  const formTitle = formNumber === '271' ? s.form271Title : s.form290Title;
  let formAdded = false;

  try {
    const row = page.locator(s.formLibraryRow).filter({ hasText: formTitle }).first();
    await row.waitFor({ state: 'visible', timeout: 10_000 });
    const addRowButton = row.locator(s.formRowAddButton).first();
    await addRowButton.waitFor({ state: 'visible', timeout: 5_000 });
    await addRowButton.click();
    formAdded = true;
  } catch { /* try next strategy */ }

  // Strategy 2: Find any element containing the form number and "Add" near it
  if (!formAdded) {
    try {
      // Look for the form title text anywhere on the page, then find the nearest Add button
      const formRow = page.locator(`text=${formTitle}`).first();
      await formRow.scrollIntoViewIfNeeded({ timeout: 5000 });

      // Click the Add button in the same row/container
      const addBtn = formRow.locator('xpath=ancestor::*[position() <= 5]').locator('button[aria-label*="Add" i], button:has-text("Add")').first();
      await addBtn.click({ timeout: 5000 });
      formAdded = true;
    } catch { /* try next strategy */ }
  }

  // Strategy 3: Use the li selector directly
  if (!formAdded) {
    const formOption = formNumber === '271'
      ? page.locator(s.form271Option).first()
      : page.locator(s.form290Option).first();

    try {
      await formOption.scrollIntoViewIfNeeded({ timeout: 10_000 });
      // Find an Add button within the option
      const addBtn = formOption.locator('button').first();
      if (await addBtn.count() > 0) {
        await addBtn.click({ timeout: 5000 });
      } else {
        await formOption.click({ timeout: 5000 });
      }
      formAdded = true;
    } catch {
      await takeScreenshot(page, `skyslope-no-form-option-${formNumber}`);
      throw new Error(`Could not add SkySlope form ${formNumber}. Form not found in the library.`);
    }
  }

  await page.waitForTimeout(UI_SETTLE_MS);
  console.log(`[Step 6] Form ${formNumber} added.`);
}

function buildRetryFileNames(baseName: string): string[] {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);

  return [
    `${baseName} (2)`,
    `${baseName} (3)`,
    `${baseName} (4)`,
    `${baseName} (${timestamp})`,
    `${baseName} (${timestamp}-2)`,
    `${baseName} (${timestamp}-3)`,
  ];
}

async function waitForCreateFormReady(page: Page, s: typeof skyslopeSelectors): Promise<void> {
  await Promise.race([
    page.locator(s.createTransactionSubmit).first().waitFor({ state: 'visible', timeout: 3_000 }),
    page.locator(s.fileNameInput).first().waitFor({ state: 'visible', timeout: 3_000 }),
  ]).catch(() => {});
  await page.waitForTimeout(UI_SETTLE_MS);
}

async function waitForFormLibraryReady(page: Page, s: typeof skyslopeSelectors): Promise<void> {
  await Promise.race([
    page.locator(s.formSearchInput).first().waitFor({ state: 'visible', timeout: 5_000 }),
    page.locator(s.formLibraryRow).first().waitFor({ state: 'visible', timeout: 5_000 }),
    page.locator(`text=${s.form271Title}`).first().waitFor({ state: 'visible', timeout: 5_000 }),
  ]).catch(() => {});
}
