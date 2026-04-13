import type { Page } from 'playwright';
import type { WorkflowContext } from '../types/workflow-state.js';
import type { ComparableSale, RealmData } from '../types/property-data.js';
import { urls } from '../../config/urls.js';
import { realmSelectors } from '../../config/selectors/realm.js';
import { writeRealmData } from '../spreadsheet.js';
import { takeScreenshot } from '../browser.js';
import { parseAddressForSkySlope } from '../skyslope-data.js';

const HISTORY_START_YEAR = 1980;
const POST_LOGIN_TIMEOUT = 30_000;
const REALM_PAGE_TIMEOUT = 30_000;

interface HistoryEntry {
  listingID?: string;
  source?: string;
  type?: string;
  timestamp?: string;
  transactionDate?: string;
  listPrice?: number;
  listPriceFormatted?: string;
  address?: {
    streetAddress?: string;
  };
}

interface PropertyHistoryResponse {
  propertyHistory?: HistoryEntry[];
}

type ComparableResponseItem = {
  address?: { streetAddress?: string };
  listPrice?: number;
  soldPrice?: number;
  soldDate?: string;
  bedrooms?: number;
  washrooms?: number;
  squareFeet?: number;
  propertyType?: string;
  style?: string;
  daysOnMarket?: number;
  lotSize?: string;
};

export async function run(ctx: WorkflowContext): Promise<void> {
  console.log('[Step 2] Searching Realm historical listings for property data...');

  const page = ctx.page;

  // Enter through the historical search URL directly.
  // If the current PropTx/Realm session is still valid, do not bounce back through
  // the generic auth/login path first.
  const searchUrl = buildHistoricalSearchUrl(ctx.address);
  console.log(`[Step 2] Navigating to search URL: ${searchUrl.substring(0, 120)}...`);
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await waitForRealmSearchAccess(page, searchUrl);
  await page.waitForTimeout(3000);

  // Step 3: Wait for results
  try {
    await waitForHistoricalResults(page);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('no historical results')) {
      throw error;
    }

    // Retry with broader search (no street suffix)
    console.log('[Step 2] Retrying with broader street-only match...');
    const broaderUrl = buildHistoricalSearchUrl(ctx.address, { includeStreetSuffix: false });
    await page.goto(broaderUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await waitForHistoricalResults(page);
  }

  await takeScreenshot(page, 'realm-search-results');

  const result = await findMatchingResult(page, ctx.address);

  if (!result) {
    await takeScreenshot(page, 'realm-no-match');
    throw new Error(`Realm did not return a historical listing match for "${ctx.address}".`);
  }

  await result.click();
  await page.locator(realmSelectors.overviewSection).first().waitFor({ state: 'visible', timeout: POST_LOGIN_TIMEOUT });

  const realmData = await extractPropertyDetails(page, ctx.address);
  const history = await fetchPropertyHistory(page, realmData.mlsNumber);
  applyHistory(realmData, history);
  realmData.comparables = await fetchComparables(page, realmData.mlsNumber);

  await writeRealmData(ctx.spreadsheetPath, realmData);
  ctx.data.realm = realmData;

  await takeScreenshot(page, 'realm-complete');
  console.log(
    `[Step 2] Realm data saved. Prior sale: ${realmData.priorSaleDate ?? 'n/a'}${realmData.comparables.length > 0 ? `, comparables: ${realmData.comparables.length}` : ''}`
  );
}

/**
 * Build a properly-encoded Realm search URL.
 *
 * The Realm q parameter uses a custom query language with pipes, comparisons, etc.
 * These are "inner-encoded" (e.g., | → %7C, >= → %3E%3D) then the whole q value
 * is standard URL-encoded when placed in the query string.
 */
function buildHistoricalSearchUrl(
  address: string,
  options: { includeStreetSuffix?: boolean } = {}
): string {
  const includeStreetSuffix = options.includeStreetSuffix ?? true;
  const streetAddress = extractStreetAddress(address);
  const parts = parseStreetAddress(streetAddress);

  // Build inner-encoded filter clauses
  const filters = [
    'availability:A,U',
    'class:FREE',
    'saleOrRent:SALE',
    'geoAnd:Y',
  ];

  if (parts.streetNumber) {
    filters.push(`streetNumberNumeric:%3E%3D${parts.streetNumber},%3C%3D${parts.streetNumber}`);
  }

  if (parts.streetName) {
    filters.push(`streetName:%3F%5D${parts.streetName.toLowerCase()}`);
  }

  filters.push(`unavailableDate:%3E%3D01%2F1%2F${HISTORY_START_YEAR}`);

  if (includeStreetSuffix && parts.streetSuffix) {
    filters.push(`streetSuffix:${parts.streetSuffix}`);
  }

  // Join with inner-encoded pipe (%7C)
  const qInnerEncoded = 'treb/' + filters.join('%7C');

  // URL-encode the inner-encoded q value for placement in URL
  const qForUrl = encodeURIComponent(qInnerEncoded);

  // Build the full URL
  const params = [
    '%24orderby=availability',
    '%24orderby=price',
    'is_map_search=false',
    'mode=table-map',
    'offset=1',
    `q=${qForUrl}`,
  ].join('&');

  return `${urls.realm}s?${params}`;
}

function extractStreetAddress(address: string): string {
  const parsed = parseAddressForSkySlope(address);
  return parsed.street || address.split(',')[0]?.trim() || address.trim();
}

function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\bsq\b/g, 'square')
    .replace(/\bcres\b/g, 'crescent')
    .replace(/\bave\b/g, 'avenue')
    .replace(/\bblvd\b/g, 'boulevard')
    .replace(/\bcrt\b/g, 'court')
    .replace(/\bdr\b/g, 'drive')
    .replace(/\bln\b/g, 'lane')
    .replace(/\bpl\b/g, 'place')
    .replace(/\bpkwy\b/g, 'parkway')
    .replace(/\brd\b/g, 'road')
    .replace(/\bst\b/g, 'street')
    .replace(/\bter\b/g, 'terrace')
    .replace(/\btrl\b/g, 'trail')
    .replace(/\bcir\b/g, 'circle')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseStreetAddress(streetAddress: string): { streetNumber?: string; streetName?: string; streetSuffix?: string } {
  const match = streetAddress.match(/^\s*(\d+[A-Za-z]?)\s+(.+?)\s+([A-Za-z.]+)\s*$/);
  if (!match) return { streetName: streetAddress };

  return {
    streetNumber: match[1],
    streetName: match[2],
    streetSuffix: match[3],
  };
}

async function findMatchingResult(page: Page, address: string) {
  const requested = parseAddressForSkySlope(address);
  const expectedStreet = normalizeAddress(requested.street || extractStreetAddress(address));
  const expectedCity = normalizeAddress(requested.city);
  const expectedPostal = normalizeAddress(requested.postalCode);
  const selectorCandidates = [
    realmSelectors.resultAddress,
    'a.streetAddress',
    'a[href^="/view/listings/"]',
    'a[href*="/view/listings/"]',
  ];

  let bestMatch: { candidate: ReturnType<Page['locator']>; score: number } | null = null;

  for (const selector of selectorCandidates) {
    const addresses = page.locator(selector);
    const count = await addresses.count();

    for (let i = 0; i < count; i++) {
      const candidate = addresses.nth(i);
      const text = normalizeAddress((await candidate.textContent()) ?? '');
      const score = scoreAddressMatch(text, expectedStreet, expectedCity, expectedPostal);
      if (score >= 100) {
        return candidate;
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { candidate, score };
      }
    }
  }

  return bestMatch && bestMatch.score >= 60 ? bestMatch.candidate : null;
}

function scoreAddressMatch(
  candidateText: string,
  expectedStreet: string,
  expectedCity: string,
  expectedPostal: string,
): number {
  let score = 0;

  if (!candidateText || !expectedStreet) {
    return score;
  }

  if (candidateText === expectedStreet) {
    score += 100;
  } else if (candidateText.startsWith(`${expectedStreet} `) || candidateText.includes(` ${expectedStreet} `)) {
    score += 80;
  } else if (expectedStreet.startsWith(`${candidateText} `)) {
    score += 60;
  } else {
    return 0;
  }

  if (expectedCity && candidateText.includes(expectedCity)) {
    score += 20;
  }

  if (expectedPostal && candidateText.includes(expectedPostal)) {
    score += 20;
  }

  return score;
}

async function extractPropertyDetails(page: Page, address: string): Promise<RealmData> {
  return page.evaluate(`
    (() => {
      var input = ${JSON.stringify({ address })};
      var normalizeLabel = function(value) { return String(value || '').toLowerCase().replace(/\\s+/g, ' ').trim(); };
      var parseNumber = function(value) {
        if (!value) return undefined;
        var cleaned = String(value).replace(/[^0-9.]/g, '');
        if (!cleaned) return undefined;
        var parsed = Number.parseFloat(cleaned);
        return Number.isNaN(parsed) ? undefined : parsed;
      };
      var text = function(selector) {
        var node = document.querySelector(selector);
        var value = node?.textContent?.replace(/\\s+/g, ' ').trim();
        return value || undefined;
      };
      var shortDetail = function(label) {
        var target = normalizeLabel(label);
        var cells = Array.from(document.querySelectorAll('#section-overview .short-details td'));
        for (var ci = 0; ci < cells.length; ci++) {
          var cell = cells[ci];
          var labelNode = cell.querySelector('.label');
          var labelText = normalizeLabel(labelNode?.textContent ?? '');
          if (!labelText.includes(target)) continue;
          var clone = cell.cloneNode(true);
          clone.querySelector?.('.label')?.remove();
          var value = clone.textContent?.replace(/\\s+/g, ' ').trim();
          if (value) return value;
        }
        return undefined;
      };
      var definition = function(sectionId) {
        var labels = Array.prototype.slice.call(arguments, 1);
        var section = document.querySelector(sectionId);
        if (!section) return undefined;
        var targets = labels.map(normalizeLabel);
        var terms = Array.from(section.querySelectorAll('dt'));
        for (var ti = 0; ti < terms.length; ti++) {
          var term = terms[ti];
          var labelText = normalizeLabel(term.textContent ?? '');
          if (targets.indexOf(labelText) === -1) continue;
          var value = term.nextElementSibling?.textContent?.replace(/\\s+/g, ' ').trim();
          if (value) return value;
        }
        return undefined;
      };
      var splitPropertyTypeAndStyle = function(value) {
        if (!value) return { propertyType: 'Residential' };
        var trimmed = String(value).replace(/\\s+/g, ' ').trim();
        var stylePatterns = [
          '2-Storey', '3-Storey', '1 1/2 Storey', 'Bungalow-Raised',
          'Bungalow', 'Backsplit', 'Sidesplit', 'Apartment', 'Loft',
        ];
        var style = stylePatterns.find(function(p) { return trimmed.toLowerCase().includes(p.toLowerCase()); });
        if (!style) return { propertyType: trimmed };
        var propertyType = trimmed.replace(style, '').replace(/\\s+/g, ' ').trim();
        return { propertyType: propertyType || trimmed, style: style };
      };

      var overviewType = text('#section-overview .addr h2');
      var typeParts = splitPropertyTypeAndStyle(overviewType);
      var listPrice = parseNumber(definition('#section-listing-info', 'List'));
      var soldPrice = parseNumber(definition('#section-listing-info', 'sold'));
      var soldDate = definition('#section-listing-info', 'Sold Date');
      var lotSize = definition('#section-property-info', 'Lot Size');
      var lotParts = lotSize?.match(/([\\d.]+)\\s*x\\s*([\\d.]+)/i);
      var parkingDriveSpaces = definition('#section-property-info', 'Parking Drive Spaces');
      var garageSpaces = definition('#section-property-info', 'Garage Parking Spaces');
      var parking = [garageSpaces ? garageSpaces + ' garage' : undefined, parkingDriveSpaces ? parkingDriveSpaces + ' drive' : undefined]
        .filter(Boolean)
        .join(', ') || definition('#section-property-info', 'Drive');

      return {
        address: text('#section-overview .addr h1') || input.address,
        mlsNumber: text('#section-overview .listing-id'),
        listPrice: listPrice,
        salePrice: soldPrice,
        saleDate: soldDate,
        propertyType: typeParts.propertyType,
        style: typeParts.style,
        bedrooms: parseNumber(definition('#section-property-info', 'Bedrooms') || shortDetail('Beds')) || 0,
        bathrooms: parseNumber(definition('#section-property-info', 'Washrooms') || shortDetail('Baths')) || 0,
        squareFootage: definition('#section-property-info', 'Square Feet') || shortDetail('SqFt'),
        lotFrontage: lotParts?.[1],
        lotDepth: lotParts?.[2],
        lotSize: lotSize,
        yearBuilt: undefined,
        garage: definition('#section-property-info', 'Garage Type'),
        parking: parking,
        basement: definition('#section-property-info', 'Basement'),
        heating: definition('#section-property-info', 'heating type', 'Heating Type'),
        cooling: definition('#section-property-info', 'A/C', 'Air Conditioning'),
        taxes: parseNumber(definition('#section-listing-info', 'Taxes')),
        taxYear: definition('#section-listing-info', 'Tax Year'),
        comparables: [],
      };
    })()
  `);
}

async function fetchPropertyHistory(page: Page, mlsNumber?: string): Promise<HistoryEntry[]> {
  if (!mlsNumber) return [];

  const listingId = mlsNumber.startsWith('TREB-') ? mlsNumber : `TREB-${mlsNumber}`;

  const payload = await page.evaluate(`
    (async () => {
      var response = await fetch('/listings/' + ${JSON.stringify(listingId)} + '/history', {
        credentials: 'include',
        headers: { accept: 'application/json', 'x-requested-with': 'XMLHttpRequest' },
      });
      return response.json();
    })()
  `) as PropertyHistoryResponse;

  return payload.propertyHistory ?? [];
}

function applyHistory(data: RealmData, history: HistoryEntry[]): void {
  if (history.length === 0) return;

  const currentListingId = data.mlsNumber?.replace(/^TREB-/, '');
  const previousSale = history.find((entry) => {
    if (!entry.listPrice) return false;
    if (entry.listingID && entry.listingID === currentListingId) return false;
    return true;
  });

  if (previousSale) {
    data.priorSalePrice = previousSale.listPrice;
    data.priorSaleDate = formatHistoryDate(previousSale.transactionDate ?? previousSale.timestamp);
  }
}

function formatHistoryDate(value?: string): string | undefined {
  if (!value) return undefined;

  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;

  return parsed.toISOString().slice(0, 10);
}

async function fetchComparables(page: Page, mlsNumber?: string): Promise<ComparableSale[]> {
  if (!mlsNumber) return [];

  const listingId = mlsNumber.startsWith('TREB-') ? mlsNumber : `TREB-${mlsNumber}`;

  const payload = await page.evaluate(`
    (async () => {
      var response = await fetch('/listings/' + ${JSON.stringify(listingId)} + '/similar?lang=en_ca', {
        credentials: 'include',
        headers: { accept: 'application/json', 'x-requested-with': 'XMLHttpRequest' },
      });
      return response.json();
    })()
  `) as ComparableResponseItem[];

  if (!Array.isArray(payload) || payload.length === 0) return [];

  return payload
    .map((item): ComparableSale | null => {
      const salePrice = item.soldPrice ?? item.listPrice;
      const addr = item.address?.streetAddress?.trim();
      if (!addr || !salePrice) return null;

      return {
        address: addr,
        salePrice,
        saleDate: item.soldDate ?? '',
        bedrooms: item.bedrooms ?? 0,
        bathrooms: item.washrooms ?? 0,
        squareFootage: item.squareFeet ?? 0,
        lotSize: item.lotSize ?? '',
        propertyType: [item.propertyType, item.style].filter(Boolean).join(' ').trim(),
        daysOnMarket: item.daysOnMarket ?? 0,
      };
    })
    .filter((item): item is ComparableSale => item !== null)
    .slice(0, 5);
}

async function selectRealmMemberAccess(page: Page): Promise<boolean> {
  const candidates = [
    page.getByRole('button', { name: /member/i }).first(),
    page.getByRole('link', { name: /member/i }).first(),
    page.getByText('Member', { exact: true }).first(),
  ];

  for (const candidate of candidates) {
    try {
      await candidate.waitFor({ state: 'visible', timeout: 2000 });
      await candidate.click();
      await page.waitForURL((url) => {
        const href = url.href.toLowerCase();
        return href.includes('sso.ampre.ca') || !href.includes('/signin');
      }, { timeout: REALM_PAGE_TIMEOUT });
      return true;
    } catch {
      // Try the next locator shape.
    }
  }

  return false;
}

async function waitForRealmLoginCheckpoint(page: Page): Promise<void> {
  console.log('[Step 2] Waiting for REALM access...');

  // If we land on the SSO login page, auto-fill credentials from .env
  let credentialsFilled = false;

  const timeoutAt = Date.now() + POST_LOGIN_TIMEOUT;
  while (Date.now() < timeoutAt) {
    if (await isRealmAccessible(page)) {
      console.log('[OK] REALM access detected. Continuing...\n');
      return;
    }

    // Detect SSO login form and auto-fill if credentials available.
    // Also retry if the first attempt failed (e.g. "Invalid User ID or PIN").
    const onSsoPage = page.url().includes('sso.ampre.ca');
    if (onSsoPage && !credentialsFilled) {
      const username = process.env.PROPTX_USERNAME;
      const password = process.env.PROPTX_PASSWORD;
      if (username && password) {
        console.log('[Step 2] SSO login page detected. Auto-filling credentials...');
        try {
          // The User ID field has no type attribute — match by position (first input before PIN)
          const userField = page.locator('input:not([type="password"]):not([type="submit"]):not([type="hidden"])').first();
          if (await userField.isVisible({ timeout: 3000 })) {
            await userField.fill(username);
            console.log('[Step 2] Filled User ID.');
          }
          const pinField = page.locator('input[type="password"]').first();
          if (await pinField.isVisible({ timeout: 2000 })) {
            await pinField.fill(password);
            console.log('[Step 2] Filled PIN.');
          }
          const submitBtn = page.locator('button:has-text("Submit"), input[type="submit"]').first();
          if (await submitBtn.isVisible({ timeout: 2000 })) {
            await submitBtn.click();
            console.log('[Step 2] Clicked Submit. Waiting for redirect...');
          }
          credentialsFilled = true;
        } catch {
          console.warn('[Step 2] Could not auto-fill SSO credentials.');
        }
      } else {
        throw new Error('REALM reached the SSO login page but no PROPTX credentials were configured for unattended automation.');
      }
    }

    await page.waitForTimeout(1000);
  }

  await takeScreenshot(page, 'realm-login-timeout');
  throw new Error(`Timed out (${POST_LOGIN_TIMEOUT / 1000}s) waiting for REALM access. Last URL: ${page.url()}`);
}

async function waitForRealmSearchAccess(page: Page, searchUrl: string): Promise<void> {
  const timeoutAt = Date.now() + POST_LOGIN_TIMEOUT;

  while (Date.now() < timeoutAt) {
    if (await isRealmSearchReady(page)) {
      return;
    }

    if (page.url().includes('app.realmmlp.ca/auth/amp')) {
      if (await selectRealmMemberAccess(page)) {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
        continue;
      }

      if (await isRealmAccessible(page)) {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
        continue;
      }
    }

    if (page.url().includes('sso.ampre.ca')) {
      await waitForRealmLoginCheckpoint(page);
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
      continue;
    }

    await page.waitForTimeout(1000);
  }

  await takeScreenshot(page, 'realm-search-access-timeout');
  throw new Error(`Timed out (${POST_LOGIN_TIMEOUT / 1000}s) reaching Realm historical search. Last URL: ${page.url()}`);
}

async function isRealmAccessible(page: Page): Promise<boolean> {
  const url = page.url();
  if (/https:\/\/app\.realmmlp\.ca\/(dashboard|s|view\/listings\/)/.test(url)) {
    return true;
  }

  return page.evaluate(`
    (() => {
      var bodyText = (document.body?.textContent ?? '').replace(/\\s+/g, ' ').trim().toLowerCase();
      var title = document.title.toLowerCase();
      var loginMarkers = [
        'my market areas', 'recent searches', 'search realm', 'filters',
        'more filters', 'search contacts documents', 'toronto regional real estate board',
      ];
      var memberMarkers = ['member', 'sign in as'];

      return loginMarkers.some(function(m) { return bodyText.includes(m) || title.includes(m); })
        || memberMarkers.some(function(m) { return bodyText.includes(m); });
    })()
  `) as Promise<boolean>;
}

async function isRealmSearchReady(page: Page): Promise<boolean> {
  const url = page.url();
  if (url.includes('/s?') || url.includes('/view/listings/')) {
    return true;
  }

  const hasResultsTable = await page.locator(realmSelectors.resultsTable).first().isVisible().catch(() => false);
  if (hasResultsTable) {
    return true;
  }

  const resultCount = await page.locator(realmSelectors.resultAddress).count().catch(() => 0);
  if (resultCount > 0) {
    return true;
  }

  return false;
}

async function waitForHistoricalResults(page: Page): Promise<void> {
  const timeoutAt = Date.now() + POST_LOGIN_TIMEOUT;

  while (Date.now() < timeoutAt) {
    const hasTableResults = await page.locator(realmSelectors.resultsTable).first().isVisible().catch(() => false);
    if (hasTableResults) return;

    const resultCount = await page.locator(realmSelectors.resultAddress).count().catch(() => 0);
    if (resultCount > 0) return;

    // Also check for any listing links
    const hasListingLinks = await page.locator('a[href*="/view/listings/"]').count().catch(() => 0);
    if (hasListingLinks > 0) return;

    const hasNoResults = await page.getByText(/your search did not match any properties/i).first().isVisible().catch(() => false);
    if (hasNoResults) {
      throw new Error(`Realm returned no historical results after applying filters. URL: ${page.url()}`);
    }

    await page.waitForTimeout(500);
  }

  await takeScreenshot(page, 'realm-results-timeout');
  throw new Error(`Timed out (30s) waiting for Realm historical results. URL: ${page.url()}`);
}
