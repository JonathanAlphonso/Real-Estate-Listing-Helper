import type { WorkflowContext } from '../types/workflow-state.js';
import type { GeowarehouseData } from '../types/property-data.js';
import { urls } from '../../config/urls.js';
import { geowarehouseSelectors } from '../../config/selectors/geowarehouse.js';
import { writeGeowarehouseData } from '../spreadsheet.js';
import { waitForManualLogin } from '../pause.js';
import { takeScreenshot } from '../browser.js';

export async function run(ctx: WorkflowContext): Promise<void> {
  console.log('[Step 3] Looking up property in Geowarehouse...');

  const page = ctx.page;
  const s = geowarehouseSelectors;

  // Navigate to Geowarehouse
  await page.goto(urls.geowarehouse, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Check if we need to log in
  const isLoggedIn = await page.locator(s.postLoginIndicator).first().isVisible().catch(() => false);
  if (!isLoggedIn) {
    await waitForManualLogin(page, s.postLoginIndicator);
  }

  if (ctx.debug) {
    console.log('[DEBUG] Pausing for selector discovery on Geowarehouse...');
    await page.pause();
  }

  // Search for the property
  const searchInput = page.locator(s.searchInput).first();
  await searchInput.waitFor({ state: 'visible', timeout: 30000 });
  await searchInput.fill(ctx.address);

  const searchButton = page.locator(s.searchButton).first();
  await searchButton.click();

  // Wait for results
  await page.waitForTimeout(3000);

  // Click first result
  const firstResult = page.locator(s.resultItem).first();
  await firstResult.click();
  await page.waitForTimeout(2000);

  // Extract property details
  const geoData = await extractGeowarehouseDetails(ctx);

  // Save to spreadsheet
  await writeGeowarehouseData(ctx.spreadsheetPath, geoData);
  ctx.data.geowarehouse = geoData;

  await takeScreenshot(page, 'geowarehouse-complete');
  console.log(`[Step 3] Geowarehouse data saved. PIN: ${geoData.pin}`);
}

async function extractGeowarehouseDetails(ctx: WorkflowContext): Promise<GeowarehouseData> {
  const page = ctx.page;
  const s = geowarehouseSelectors;

  async function getText(selector: string): Promise<string> {
    try {
      const el = page.locator(selector).first();
      const text = await el.textContent({ timeout: 5000 });
      return text?.trim() || '';
    } catch {
      return '';
    }
  }

  async function getNumber(selector: string): Promise<number | undefined> {
    const text = await getText(selector);
    if (!text) return undefined;
    const num = parseFloat(text.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? undefined : num;
  }

  // Extract registered owners (may be multiple)
  let owners: string[] = [];
  try {
    const ownerElements = page.locator(s.registeredOwners);
    const count = await ownerElements.count();
    for (let i = 0; i < count; i++) {
      const text = await ownerElements.nth(i).textContent();
      if (text?.trim()) owners.push(text.trim());
    }
  } catch {
    owners = [];
  }

  return {
    pin: await getText(s.pin),
    legalDescription: await getText(s.legalDescription),
    municipalAddress: await getText(s.municipalAddress) || ctx.address,
    municipality: await getText(s.municipality),
    lotDimensions: await getText(s.lotDimensions),
    lotArea: (await getText(s.lotArea)) || undefined,
    registeredOwners: owners,
    assessedValue: await getNumber(s.assessedValue),
    assessmentYear: (await getText(s.assessedValue + ' + td')) || undefined,
    propertyClass: (await getText(s.propertyClass)) || undefined,
    landRegistryOffice: (await getText(s.instrumentNumber)) || undefined,
    instrumentNumber: (await getText(s.instrumentNumber)) || undefined,
    registrationDate: (await getText(s.registrationDate)) || undefined,
  };
}
