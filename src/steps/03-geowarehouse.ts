import type { Page } from 'playwright';
import type { WorkflowContext } from '../types/workflow-state.js';
import type { GeowarehouseData } from '../types/property-data.js';
import { geowarehouseSelectors } from '../../config/selectors/geowarehouse.js';
import { writeGeowarehouseData, writePropertyData } from '../spreadsheet.js';
import { takeScreenshot } from '../browser.js';
import { buildInitialPropertyData, inferCounty, parseAddressForSkySlope, parseMunicipalAddress } from '../skyslope-data.js';
import { fieldMappings } from '../../config/field-mappings.js';

export async function run(ctx: WorkflowContext): Promise<void> {
  console.log('[Step 3] Looking up property in Geowarehouse...');

  // Remember the original page so we can return to it for Realm
  const originalPage = ctx.page;

  ctx.page = await openGeowarehouseFromPropTx(ctx.page);
  const page = ctx.page;

  await waitForGeowarehouseApp(page);

  // Search for the property
  await searchGeowarehouse(page, ctx.address);

  // Wait for and pick the best result
  await pickSearchResult(page, ctx.address);

  // Wait for the detail panel to load (URL should change to include pin=)
  await waitForDetailPanel(page);
  await takeScreenshot(page, 'geowarehouse-result-selected');

  // Extract property details by reading each tab
  const geoData = await extractGeowarehouseDetails(ctx);

  // Save to property CSV
  await writeGeowarehouseData(ctx.spreadsheetPath, geoData);
  const initialPropertyData = buildInitialPropertyData(ctx.address);
  const municipalAddressParts = parseMunicipalAddress(geoData.municipalAddress);
  await writePropertyData(ctx.spreadsheetPath, {
    [fieldMappings.address.spreadsheetColumn]: ctx.address,
    [fieldMappings.city.spreadsheetColumn]:
      initialPropertyData[fieldMappings.city.spreadsheetColumn] || municipalAddressParts.city,
    [fieldMappings.province.spreadsheetColumn]: initialPropertyData[fieldMappings.province.spreadsheetColumn],
    [fieldMappings.postalCode.spreadsheetColumn]:
      initialPropertyData[fieldMappings.postalCode.spreadsheetColumn] || municipalAddressParts.postalCode,
    [fieldMappings.county.spreadsheetColumn]:
      inferCounty(geoData.municipality) || initialPropertyData[fieldMappings.county.spreadsheetColumn],
    [fieldMappings.sellerName.spreadsheetColumn]: geoData.registeredOwners.join('; '),
  });
  ctx.data.geowarehouse = geoData;

  await takeScreenshot(page, 'geowarehouse-complete');
  console.log(`[Step 3] Geowarehouse data saved. PIN: ${geoData.pin}`);

  // Return to the original PropTx page for subsequent steps
  if (page !== originalPage) {
    ctx.page = originalPage;
  }
}

async function waitForDetailPanel(page: Page): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const url = page.url();
    if (url.includes('pin=')) {
      console.log(`[Step 3] Detail panel loaded. URL: ${url}`);
      return;
    }
    const hasDetail = await page.evaluate(`
      (() => {
        var body = (document.body?.innerText ?? '').toLowerCase();
        return body.includes('property details') || body.includes('owner name') || body.includes('legal description');
      })()
    `) as boolean;
    if (hasDetail) return;
    await page.waitForTimeout(1000);
  }
  console.log('[Step 3] Warning: Detail panel may not have fully loaded.');
}

async function searchGeowarehouse(page: Page, address: string): Promise<void> {
  const parsed = parseAddressForSkySlope(address);
  const streetAddress = parsed.street || address.split(',')[0]?.trim() || address.trim();
  const searchQuery = [streetAddress, parsed.city].filter(Boolean).join(', ');
  console.log(`[Step 3] Searching Geowarehouse for: "${searchQuery}"`);

  const searchFilled = await page.evaluate(`
    (() => {
      var query = ${JSON.stringify(searchQuery)};
      var inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
      for (var i = 0; i < inputs.length; i++) {
        var input = inputs[i];
        var placeholder = (input.placeholder || '').toLowerCase();
        if (placeholder.includes('address') || placeholder.includes('pin') || placeholder.includes('search')) {
          input.focus();
          var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          setter?.call(input, query);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      return false;
    })()
  `);

  if (!searchFilled) {
    const input = page.locator(geowarehouseSelectors.searchInput).first();
    await input.waitFor({ state: 'visible', timeout: 15000 });
    await input.click();
    await input.fill(searchQuery);
  }

  await page.waitForTimeout(500);

  const searchClicked = await page.evaluate(`
    (() => {
      var buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      for (var i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        var text = (btn.textContent || '').trim() || (btn.value || '');
        if (text === 'Search' || (text.toLowerCase().includes('search') && !text.toLowerCase().includes('comparable'))) {
          btn.click();
          return true;
        }
      }
      return false;
    })()
  `);

  if (!searchClicked) {
    const searchBtn = page.locator(geowarehouseSelectors.searchButton).first();
    await searchBtn.waitFor({ state: 'visible', timeout: 10000 });
    await searchBtn.click();
  }

  console.log('[Step 3] Search submitted, waiting for results...');
  await page.waitForTimeout(3000);
}

async function pickSearchResult(page: Page, address: string): Promise<void> {
  const parsed = parseAddressForSkySlope(address);
  const streetAddress = normalizeAddressFragment(parsed.street || address.split(',')[0]?.trim() || address.trim());
  const city = normalizeAddressFragment(parsed.city);
  const postalCode = normalizeAddressFragment(parsed.postalCode);
  const deadline = Date.now() + 20_000;
  let resultFound = false;

  while (Date.now() < deadline) {
    const currentUrl = page.url();
    if (currentUrl.includes('pin=')) {
      console.log('[Step 3] Already on detail page.');
      resultFound = true;
      break;
    }

    const clicked: string | null = await page.evaluate(`
      (() => {
        var targetStreet = ${JSON.stringify(streetAddress)};
        var targetCity = ${JSON.stringify(city)};
        var targetPostal = ${JSON.stringify(postalCode)};
        var normalize = function(s) {
          return s
            .toLowerCase()
            .replace(/[.,#]/g, ' ')
            .replace(/\\s+/g, ' ')
            .trim();
        };
        var scoreMatch = function(text) {
          if (!text || !targetStreet) return 0;

          var score = 0;
          if (text === targetStreet) score += 100;
          else if (text.indexOf(targetStreet + ' ') === 0 || text.indexOf(' ' + targetStreet + ' ') >= 0) score += 80;
          else if (targetStreet.indexOf(text + ' ') === 0) score += 60;
          else return 0;

          if (targetCity && text.indexOf(targetCity) >= 0) score += 20;
          if (targetPostal && text.indexOf(targetPostal) >= 0) score += 20;
          return score;
        };

        // Try omnibar results first (ob-list items), then fall back to generic candidates
        var candidates = Array.from(document.querySelectorAll(
          '${geowarehouseSelectors.resultItem}, a, tr, .search-result, .result-item, [class*="result"], [class*="Result"], [role="row"], [role="link"]'
        ));
        var best = null;
        var bestScore = 0;

        for (var i = 0; i < candidates.length; i++) {
          var el = candidates[i];
          var text = normalize(el.textContent || '');
          var score = scoreMatch(text);
          if (score > bestScore) {
            best = el;
            bestScore = score;
          }
        }

        if (best && bestScore >= 60) {
          var link = best.tagName === 'A' ? best : best.querySelector('a');
          if (link) { link.click(); return 'link'; }
          best.click();
          return 'element';
        }

        return null;
      })()
    `);

    if (clicked) {
      console.log(`[Step 3] Clicked result (strategy: ${clicked})`);
      resultFound = true;
      break;
    }

    const noResults: boolean = await page.evaluate(`
      (() => {
        var bodyText = (document.body?.textContent ?? '').toLowerCase();
        return bodyText.includes('no results') || bodyText.includes('no records') || bodyText.includes('0 results');
      })()
    `);

    if (noResults) {
      await takeScreenshot(page, 'geowarehouse-no-results');
      throw new Error('Geowarehouse search returned no results.');
    }

    await page.waitForTimeout(1000);
  }

  if (!resultFound) {
    await takeScreenshot(page, 'geowarehouse-no-result-clicked');
    throw new Error(`Could not find or click a Geowarehouse result for "${address}" within timeout.`);
  }

  await page.waitForTimeout(3000);
  await page.waitForLoadState('domcontentloaded').catch(() => {});
}

async function extractGeowarehouseDetails(ctx: WorkflowContext): Promise<GeowarehouseData> {
  const page = ctx.page;
  await page.waitForTimeout(2000);

  // Extract PIN from URL query param
  const currentUrl = page.url();
  const pinFromUrl = currentUrl.match(/pin=(\d+)/)?.[1] ?? '';

  // Read data from stable HTML IDs across Summary (sum-*), Registry (reg-*),
  // and Valuation & Sales (vs-*) panels.
  const data = await page.evaluate(`
    (() => {
      var text = function(sel) {
        var el = document.querySelector(sel);
        return el ? el.textContent.trim() : '';
      };

      return {
        // Summary panel (sum-*)
        sum_address:      text('${geowarehouseSelectors.summaryAddress}'),
        sum_owners:       text('${geowarehouseSelectors.summaryOwnerNames}'),
        sum_lastSale:     text('${geowarehouseSelectors.summaryLastSaleValue}'),
        sum_lastSaleDate: text('${geowarehouseSelectors.summaryLastSaleDate}'),
        sum_lotArea:      text('${geowarehouseSelectors.summaryLotArea}'),
        sum_lotPerimeter: text('${geowarehouseSelectors.summaryLotPerimeter}'),
        sum_legalDesc:    text('${geowarehouseSelectors.summaryLegalDescription}'),

        // Registry / Property Details (reg-*)
        reg_address:      text('${geowarehouseSelectors.regAddress}'),
        reg_pin:          text('${geowarehouseSelectors.regPin}'),
        reg_lro:          text('${geowarehouseSelectors.regLro}'),
        reg_owners:       text('${geowarehouseSelectors.regOwnerNames}') || text('${geowarehouseSelectors.regOwnerNamesAlt}'),
        reg_propertyType: text('${geowarehouseSelectors.regPropertyType}'),
        reg_ownershipType:text('${geowarehouseSelectors.regOwnershipType}'),
        reg_legalDesc:    text('${geowarehouseSelectors.regLegalDescription}'),

        // Sales history from Valuation & Sales tab (vs-*)
        // Extract the first sale row for instrument/registration date
        vs_salesHistory:  text('${geowarehouseSelectors.vsSalesHistoryContainer}'),
      };
    })()
  `) as Record<string, string>;

  // Build GeowarehouseData from the best available source for each field
  const pin = pinFromUrl || data.reg_pin || '';
  const legalDescription = data.sum_legalDesc || data.reg_legalDesc || '';
  const municipalAddress = data.sum_address || data.reg_address || ctx.address;
  const municipality = extractMunicipality(ctx.address);
  const rawOwners = data.sum_owners || data.reg_owners || '';
  const owners = normalizeOwnerNames(rawOwners);
  const lotArea = data.sum_lotArea || undefined;
  const lotPerimeter = data.sum_lotPerimeter || '';
  const lotDimensions = [lotArea, lotPerimeter ? `(${lotPerimeter} perimeter)` : ''].filter(Boolean).join(' ') || '';
  const propertyClass = data.reg_propertyType || undefined;
  const lro = data.reg_lro || undefined;

  // Extract registration date from sales history text if available
  const salesHistoryDate = parseSalesHistoryDate(data.vs_salesHistory);

  const geoData: GeowarehouseData = {
    pin,
    legalDescription,
    municipalAddress,
    municipality,
    lotDimensions,
    lotArea,
    registeredOwners: owners,
    assessedValue: undefined,
    assessmentYear: undefined,
    propertyClass,
    landRegistryOffice: lro,
    instrumentNumber: undefined,
    registrationDate: salesHistoryDate,
  };

  const fields = Object.entries(geoData);
  const filled = fields.filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0));
  const missing = fields.filter(([, v]) => v === undefined || v === '' || (Array.isArray(v) && v.length === 0));
  console.log(`[Step 3] Extracted ${filled.length}/${fields.length} fields`);
  if (missing.length > 0) {
    console.log(`[Step 3] Missing fields: ${missing.map(([k]) => k).join(', ')}`);
  }
  console.log(`[Step 3] PIN: ${geoData.pin}, Owners: ${geoData.registeredOwners.join('; ')}, LegalDesc: ${geoData.legalDescription.substring(0, 60)}`);

  return geoData;
}

/**
 * Parse owner names from Geowarehouse into a clean array.
 * Handles: semicolon-delimited, newline-delimited, and single flat strings.
 * Preserves "LAST, FIRST" format but normalizes whitespace and separators.
 */
function normalizeOwnerNames(raw: string): string[] {
  if (!raw.trim()) return [];

  // Split on semicolons, newlines, or " AND " (case-insensitive)
  const parts = raw
    .split(/[;\n]|\bAND\b/i)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => s.length > 0);

  return parts;
}

/**
 * Extract the most recent sale date from the Valuation & Sales history text.
 * The sales history table text looks like:
 * "Sale DateSale AmountTypeParty ToNotes Aug 13, 1998 $305,000 Transfer ELIOPOULOS-..."
 */
function parseSalesHistoryDate(salesText: string): string | undefined {
  if (!salesText) return undefined;

  // Match dates like "Aug 13, 1998" or "Jan 1, 2020"
  const dateMatch = salesText.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (!dateMatch) return undefined;

  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const month = months[dateMatch[1].toLowerCase()];
  const day = dateMatch[2].padStart(2, '0');
  const year = dateMatch[3];

  return `${year}-${month}-${day}`;
}

function extractMunicipality(fullAddress: string): string {
  return parseAddressForSkySlope(fullAddress).city;
}

function normalizeAddressFragment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- PropTx launcher functions ---

async function openGeowarehouseFromPropTx(page: WorkflowContext['page']): Promise<Page> {
  const url = page.url().toLowerCase();

  const bodyText = await page.evaluate(`
    (() => (document.body?.textContent?.replace(/\\s+/g, ' ').trim().toLowerCase() ?? ''))()
  `).catch(() => '') as string;

  if (!url.includes('ontariomlp.ca')
      && !url.includes('torontomls.net') && !url.includes('geowarehouse.ca')
      && !bodyText.includes('geowarehouse')) {
    // Not on PropTx — try navigating directly to Geowarehouse (SSO cookies should carry)
    console.log('[Step 3] Not on PropTx page. Navigating directly to Geowarehouse...');
    await page.goto('https://collaboration.geowarehouse.ca/ui/home', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    // If Geowarehouse loaded directly via SSO, return the current page
    const newUrl = page.url().toLowerCase();
    if (newUrl.includes('collaboration.geowarehouse.ca') && !newUrl.includes('/ui/login')) {
      return page;
    }
    // Fallback: try the TRREB portal
    console.log('[Step 3] Direct Geowarehouse access failed. Trying TRREB portal...');
    await page.goto('https://ontariomlp.ca/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  }

  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await waitForPropTxLauncherSurface(page);

  const directTarget = await tryLaunchGeowarehouse(page);
  if (directTarget) return directTarget;

  await openPropTxToolsLayer(page);

  const modalTarget = await tryLaunchGeowarehouse(page);
  if (modalTarget) return modalTarget;

  throw new Error(`Could not find the GeoWarehouse launcher on the PropTx page. Current URL: ${page.url()}`);
}

async function waitForPropTxLauncherSurface(page: WorkflowContext['page']): Promise<void> {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    const launcherCount = await page.locator(geowarehouseSelectors.launcherLink).count().catch(() => 0);
    const toolsVisible = await page.locator('#load-tools-modal').first().isVisible().catch(() => false);
    const bodyText = (await page.locator('body').textContent({ timeout: 1000 }).catch(() => '')) ?? '';
    const normalizedBody = bodyText.replace(/\s+/g, ' ').toLowerCase();

    if (launcherCount > 0 || toolsVisible || normalizedBody.includes('geowarehouse')) {
      return;
    }

    await page.waitForTimeout(1000);
  }

  throw new Error(`PropTx welcome page did not expose the GeoWarehouse launcher within 30 seconds. Last URL: ${page.url()}`);
}

async function tryLaunchGeowarehouse(page: WorkflowContext['page']): Promise<Page | null> {
  const launchCandidates = [
    page.getByRole('link', { name: /geowarehouse/i }).first(),
    page.locator('a[href*="/geowarehouse"]').first(),
    page.locator(geowarehouseSelectors.launcherLink).first(),
  ];

  for (const candidate of launchCandidates) {
    try {
      await candidate.waitFor({ state: 'attached', timeout: 2000 });

      const popupPromise = page.context().waitForEvent('page', { timeout: 5000 }).catch(() => null);
      await candidate.evaluate((element: HTMLElement) => element.click());
      const popup = await popupPromise;
      const targetPage = popup ?? page;

      await targetPage.waitForLoadState('domcontentloaded').catch(() => {});
      return targetPage;
    } catch {
      // Try the next launcher candidate.
    }
  }

  return null;
}

async function openPropTxToolsLayer(page: WorkflowContext['page']): Promise<void> {
  const openers = [
    page.locator('#load-tools-modal').first(),
    page.getByRole('button', { name: /mls.*tools/i }).first(),
    page.getByRole('link', { name: /mls.*tools/i }).first(),
    page.getByRole('button', { name: /tools/i }).first(),
    page.getByRole('link', { name: /tools/i }).first(),
  ];

  for (const opener of openers) {
    try {
      await opener.waitFor({ state: 'visible', timeout: 1500 });
      await opener.click();
      await page.waitForTimeout(1000);
      return;
    } catch {
      // Try the next opener.
    }
  }
}

async function waitForGeowarehouseApp(page: WorkflowContext['page']): Promise<void> {
  const timeoutAt = Date.now() + 30_000;

  while (Date.now() < timeoutAt) {
    const url = page.url().toLowerCase();

    if (url.includes('auth.geowarehouse.ca')) {
      throw new Error('Geowarehouse opened its standalone login page. PropTx session handoff failed.');
    }

    if (url.includes('collaboration.geowarehouse.ca') && !url.includes('/ui/login') && !url.includes('login-with-okta')) {
      return;
    }

    await page.waitForTimeout(1000);
  }

  throw new Error(`Timed out waiting for Geowarehouse to open from PropTx. Last URL: ${page.url()}`);
}
