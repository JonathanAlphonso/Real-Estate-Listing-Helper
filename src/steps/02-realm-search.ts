import type { Page } from 'playwright';
import type { WorkflowContext } from '../types/workflow-state.js';
import type { ComparableSale, RealmData } from '../types/property-data.js';
import { urls } from '../../config/urls.js';
import { realmSelectors } from '../../config/selectors/realm.js';
import { writeRealmData } from '../spreadsheet.js';
import { takeScreenshot } from '../browser.js';

const HISTORY_START_YEAR = 1980;

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
  const searchUrl = buildHistoricalSearchUrl(ctx.address);

  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await page.locator(realmSelectors.resultsTable).first().waitFor({ state: 'visible', timeout: 30000 });

  if (ctx.debug) {
    console.log('[DEBUG] Historical search results loaded. Pausing for inspection...');
    await page.pause();
  }

  const result = await findMatchingResult(page, ctx.address);

  if (!result) {
    throw new Error(`Realm did not return a historical listing match for "${ctx.address}".`);
  }

  await result.click();
  await page.locator(realmSelectors.detailModal).first().waitFor({ state: 'visible', timeout: 30000 });
  await page.locator(realmSelectors.detailContainer).first().waitFor({ state: 'visible', timeout: 30000 });

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

function buildHistoricalSearchUrl(address: string): string {
  const streetAddress = extractStreetAddress(address);
  const query = `treb/addr:?]${streetAddress}|unavailableDate:>=1/1/${HISTORY_START_YEAR}`;
  return `${urls.realm}s?is_map_search=false&mode=table-map&q=${encodeURIComponent(query)}`;
}

function extractStreetAddress(address: string): string {
  return address.split(',')[0]?.trim() ?? address.trim();
}

function normalizeAddress(address: string): string {
  return address.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

async function findMatchingResult(page: Page, address: string) {
  const expected = normalizeAddress(extractStreetAddress(address));
  const addresses = page.locator(realmSelectors.resultAddress);
  const count = await addresses.count();

  for (let i = 0; i < count; i++) {
    const candidate = addresses.nth(i);
    const text = normalizeAddress((await candidate.textContent()) ?? '');
    if (text === expected) {
      return candidate;
    }
  }

  return null;
}

async function extractPropertyDetails(page: Page, address: string): Promise<RealmData> {
  return page.evaluate((input) => {
    function normalizeLabel(value: string): string {
      return value.toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function parseNumber(value?: string): number | undefined {
      if (!value) return undefined;
      const cleaned = value.replace(/[^0-9.]/g, '');
      if (!cleaned) return undefined;
      const parsed = Number.parseFloat(cleaned);
      return Number.isNaN(parsed) ? undefined : parsed;
    }

    function text(selector: string): string | undefined {
      const node = document.querySelector(selector);
      const value = node?.textContent?.replace(/\s+/g, ' ').trim();
      return value || undefined;
    }

    function shortDetail(label: string): string | undefined {
      const target = normalizeLabel(label);
      const cells = Array.from(document.querySelectorAll<HTMLTableCellElement>('#section-overview .short-details td'));

      for (const cell of cells) {
        const labelNode = cell.querySelector('.label');
        const labelText = normalizeLabel(labelNode?.textContent ?? '');
        if (!labelText.includes(target)) continue;

        const clone = cell.cloneNode(true) as HTMLElement;
        clone.querySelector('.label')?.remove();
        const value = clone.textContent?.replace(/\s+/g, ' ').trim();
        if (value) return value;
      }

      return undefined;
    }

    function definition(sectionId: string, ...labels: string[]): string | undefined {
      const section = document.querySelector(sectionId);
      if (!section) return undefined;

      const targets = labels.map(normalizeLabel);
      const terms = Array.from(section.querySelectorAll<HTMLElement>('dt'));

      for (const term of terms) {
        const labelText = normalizeLabel(term.textContent ?? '');
        if (!targets.includes(labelText)) continue;

        const value = term.nextElementSibling?.textContent?.replace(/\s+/g, ' ').trim();
        if (value) return value;
      }

      return undefined;
    }

    function splitPropertyTypeAndStyle(value?: string): { propertyType: string; style?: string } {
      if (!value) {
        return { propertyType: 'Residential' };
      }

      const trimmed = value.replace(/\s+/g, ' ').trim();
      const stylePatterns = [
        '2-Storey',
        '3-Storey',
        '1 1/2 Storey',
        'Bungalow-Raised',
        'Bungalow',
        'Backsplit',
        'Sidesplit',
        'Apartment',
        'Loft',
      ];

      const style = stylePatterns.find((pattern) => trimmed.toLowerCase().includes(pattern.toLowerCase()));

      if (!style) {
        return { propertyType: trimmed };
      }

      const propertyType = trimmed.replace(style, '').replace(/\s+/g, ' ').trim();
      return {
        propertyType: propertyType || trimmed,
        style,
      };
    }

    const overviewType = text('#section-overview .addr h2');
    const typeParts = splitPropertyTypeAndStyle(overviewType);
    const listPrice = parseNumber(definition('#section-listing-info', 'List'));
    const soldPrice = parseNumber(definition('#section-listing-info', 'sold'));
    const soldDate = definition('#section-listing-info', 'Sold Date');
    const lotSize = definition('#section-property-info', 'Lot Size');
    const lotParts = lotSize?.match(/([\d.]+)\s*x\s*([\d.]+)/i);
    const parkingDriveSpaces = definition('#section-property-info', 'Parking Drive Spaces');
    const garageSpaces = definition('#section-property-info', 'Garage Parking Spaces');
    const parking = [garageSpaces ? `${garageSpaces} garage` : undefined, parkingDriveSpaces ? `${parkingDriveSpaces} drive` : undefined]
      .filter(Boolean)
      .join(', ') || definition('#section-property-info', 'Drive');

    return {
      address: text('#section-overview .addr h1') || input.address,
      mlsNumber: text('#section-overview .listing-id'),
      listPrice,
      salePrice: soldPrice,
      saleDate: soldDate,
      propertyType: typeParts.propertyType,
      style: typeParts.style,
      bedrooms: parseNumber(definition('#section-property-info', 'Bedrooms') || shortDetail('Beds')) || 0,
      bathrooms: parseNumber(definition('#section-property-info', 'Washrooms') || shortDetail('Baths')) || 0,
      squareFootage: parseNumber(definition('#section-property-info', 'Square Feet') || shortDetail('SqFt')),
      lotFrontage: lotParts?.[1],
      lotDepth: lotParts?.[2],
      lotSize,
      yearBuilt: undefined,
      garage: definition('#section-property-info', 'Garage Type'),
      parking,
      basement: definition('#section-property-info', 'Basement'),
      heating: definition('#section-property-info', 'heating type', 'Heating Type'),
      cooling: definition('#section-property-info', 'A/C', 'Air Conditioning'),
      taxes: parseNumber(definition('#section-listing-info', 'Taxes')),
      taxYear: definition('#section-listing-info', 'Tax Year'),
      comparables: [],
    };
  }, { address });
}

async function fetchPropertyHistory(page: Page, mlsNumber?: string): Promise<HistoryEntry[]> {
  if (!mlsNumber) {
    return [];
  }

  const listingId = mlsNumber.startsWith('TREB-') ? mlsNumber : `TREB-${mlsNumber}`;

  const payload = await page.evaluate(async (id) => {
    const response = await fetch(`/listings/${id}/history`, {
      credentials: 'include',
      headers: {
        accept: 'application/json',
        'x-requested-with': 'XMLHttpRequest',
      },
    });

    return response.json() as Promise<PropertyHistoryResponse>;
  }, listingId);

  return payload.propertyHistory ?? [];
}

function applyHistory(data: RealmData, history: HistoryEntry[]): void {
  if (history.length === 0) {
    return;
  }

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
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString().slice(0, 10);
}

async function fetchComparables(page: Page, mlsNumber?: string): Promise<ComparableSale[]> {
  if (!mlsNumber) {
    return [];
  }

  const listingId = mlsNumber.startsWith('TREB-') ? mlsNumber : `TREB-${mlsNumber}`;

  const payload = await page.evaluate(async (id) => {
    const response = await fetch(`/listings/${id}/similar?lang=en_ca`, {
      credentials: 'include',
      headers: {
        accept: 'application/json',
        'x-requested-with': 'XMLHttpRequest',
      },
    });

    return response.json() as Promise<ComparableResponseItem[]>;
  }, listingId);

  if (!Array.isArray(payload) || payload.length === 0) {
    return [];
  }

  return payload
    .map((item): ComparableSale | null => {
      const salePrice = item.soldPrice ?? item.listPrice;
      const address = item.address?.streetAddress?.trim();

      if (!address || !salePrice) {
        return null;
      }

      return {
        address,
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
