import { fieldMappings } from '../config/field-mappings.js';
import { listingDefaults } from '../config/defaults.js';

export interface AddressParts {
  street: string;
  city: string;
  province: string;
  postalCode: string;
}

export interface SkySlopeValueResolution {
  source: 'csv' | 'derived' | 'default' | 'missing';
  value?: string;
}

export interface MunicipalAddressParts {
  city: string;
  postalCode: string;
}

const POSTAL_CODE_PATTERN = /[A-Z]\d[A-Z]\s?\d[A-Z]\d/i;
const STREET_SUFFIXES = new Set([
  'street', 'st',
  'avenue', 'ave',
  'road', 'rd',
  'crescent', 'cres',
  'court', 'crt',
  'drive', 'dr',
  'boulevard', 'blvd',
  'lane', 'ln',
  'place', 'pl',
  'square', 'sq',
  'trail', 'trl',
  'terrace', 'ter',
  'way',
  'parkway', 'pkwy',
  'circle', 'cir',
  'close', 'cl',
  'gate',
  'row',
  'path',
]);

export function buildInitialPropertyData(address: string): Record<string, string> {
  const parsed = parseAddressForSkySlope(address);

  return {
    [fieldMappings.address.spreadsheetColumn]: address,
    [fieldMappings.city.spreadsheetColumn]: parsed.city,
    [fieldMappings.province.spreadsheetColumn]: parsed.province,
    [fieldMappings.postalCode.spreadsheetColumn]: parsed.postalCode,
    [fieldMappings.county.spreadsheetColumn]: inferCounty(parsed.city),
    [fieldMappings.sellerName.spreadsheetColumn]: '',
    [fieldMappings.sellerEmail.spreadsheetColumn]: '',
    [fieldMappings.skyslopeFileUrl.spreadsheetColumn]: '',
  };
}

export function parseAddressForSkySlope(address: string): AddressParts {
  const normalized = address.replace(/\s+/g, ' ').trim();
  const postalMatch = normalized.match(POSTAL_CODE_PATTERN);
  const postalCode = formatPostalCode(postalMatch?.[0] || '');
  const withoutPostalCode = normalizeSegment(normalized.replace(POSTAL_CODE_PATTERN, ''));
  const parts = withoutPostalCode.split(',').map(normalizeSegment).filter(Boolean);

  let street = parts[0] || normalized;
  let city = parts[1] || '';
  let provinceSource = parts[2] || '';

  if (parts.length === 2 && looksLikeProvinceSegment(parts[1])) {
    const split = splitStreetAndCity(parts[0]);
    street = split.street;
    city = split.city;
    provinceSource = parts[1];
  } else if (parts.length === 1) {
    const split = splitStreetAndCity(parts[0] || normalized);
    street = split.street;
    city = split.city;
  }

  const province = normalizeProvince(extractProvince(provinceSource) || 'Ontario');

  return {
    street,
    city: toTitleCase(city),
    province,
    postalCode,
  };
}

export function parseMunicipalAddress(municipalAddress: string): MunicipalAddressParts {
  const parts = municipalAddress.split(',').map((value) => value.trim()).filter(Boolean);
  const city = parts[1] ? toTitleCase(parts[1]) : '';
  const postalMatch = municipalAddress.match(/[A-Z]\d[A-Z]\s?\d[A-Z]\d/i);
  const compactPostalCode = postalMatch ? postalMatch[0].replace(/\s+/g, '').toUpperCase() : '';
  const postalCode = compactPostalCode
    ? compactPostalCode.replace(/^(.{3})(.{3})$/, '$1 $2')
    : '';

  return {
    city,
    postalCode,
  };
}

export function normalizeProvince(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'ontario') {
    return 'ON';
  }

  return value.trim();
}

function normalizeSegment(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function formatPostalCode(value: string): string {
  const compact = value.replace(/\s+/g, '').toUpperCase();
  return compact.length === 6
    ? compact.replace(/^(.{3})(.{3})$/, '$1 $2')
    : compact;
}

function looksLikeProvinceSegment(value: string): boolean {
  return Boolean(extractProvince(value));
}

function extractProvince(value: string): string | undefined {
  const normalized = normalizeSegment(value).toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized.includes('ontario') || normalized === 'on') {
    return 'Ontario';
  }

  return undefined;
}

function splitStreetAndCity(value: string): { street: string; city: string } {
  const normalized = normalizeSegment(value);
  const tokens = normalized.split(' ').filter(Boolean);

  for (let index = tokens.length - 1; index >= 1; index--) {
    const token = tokens[index]!.replace(/\./g, '').toLowerCase();
    if (!STREET_SUFFIXES.has(token)) {
      continue;
    }

    return {
      street: tokens.slice(0, index + 1).join(' '),
      city: tokens.slice(index + 1).join(' '),
    };
  }

  return { street: normalized, city: '' };
}

export function inferCounty(cityOrMunicipality: string): string {
  const normalized = cityOrMunicipality.trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  const countyMap: Array<{ county: string; matches: string[] }> = [
    { county: 'Toronto', matches: ['toronto', 'scarborough', 'north york', 'etobicoke', 'east york', 'york'] },
    { county: 'Peel', matches: ['brampton', 'mississauga', 'caledon'] },
    { county: 'York', matches: ['markham', 'vaughan', 'richmond hill', 'thornhill', 'aurora', 'newmarket', 'king', 'georgina', 'east gwillimbury', 'whitchurch-stouffville', 'stouffville'] },
    { county: 'Durham', matches: ['ajax', 'pickering', 'oshawa', 'whitby', 'clarington', 'uxbridge', 'brock', 'scugog'] },
    { county: 'Halton', matches: ['oakville', 'burlington', 'milton', 'halton hills', 'georgetown'] },
  ];

  for (const county of countyMap) {
    if (county.matches.some((value) => normalized === value)) {
      return county.county;
    }
  }

  return '';
}

export function parseRegisteredOwners(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parsePrimaryContact(value: string): { firstName: string; lastName: string } {
  if (!value.trim()) {
    return { firstName: '', lastName: '' };
  }

  const reversedParts = value.includes(',')
    ? value.split(',').map((part) => part.trim()).filter(Boolean)
    : [];

  if (reversedParts.length >= 2) {
    return {
      firstName: reversedParts[1] || '',
      lastName: reversedParts[0] || '',
    };
  }

  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0]!, lastName: parts[0]! };
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.at(-1) ?? '',
  };
}

export function resolveSkySlopeFieldValue(fieldName: string, data: Record<string, string>): SkySlopeValueResolution {
  const mapping = fieldMappings[fieldName];
  if (!mapping) {
    return { source: 'missing' };
  }

  const directValue = normalizeValue(data[mapping.spreadsheetColumn]);
  if (directValue) {
    return { source: 'csv', value: directValue };
  }

  const derivedValue = deriveSkySlopeFieldValue(fieldName, data);
  if (derivedValue) {
    return { source: 'derived', value: derivedValue };
  }

  const defaultValue = normalizeValue(listingDefaults[fieldName]);
  if (defaultValue) {
    return { source: 'default', value: defaultValue };
  }

  return { source: 'missing' };
}

function deriveSkySlopeFieldValue(fieldName: string, data: Record<string, string>): string | undefined {
  switch (fieldName) {
    case 'sellerName':
      return normalizeValue(data['Registered Owners']);
    case 'county':
      return inferCounty(data['City'] || data['Municipality'] || '');
    case 'area':
      return normalizeValue(data['Area']) || normalizeValue(data['City']) || normalizeValue(data['Municipality']);
    case 'municipality':
      return normalizeValue(data['Municipality']) || normalizeValue(data['City']);
    case 'community':
      return normalizeValue(data['Community']) || normalizeValue(data['City']);
    case 'assessmentValue':
      return normalizeValue(data['Assessment Value']);
    case 'assessmentYear':
      return normalizeValue(data['Assessment Year']);
    case 'garageType':
      return normalizeGarageType(data['Garage']);
    case 'garageParkingSpaces':
      return normalizeValue(data['Garage Spaces']) || parseGarageSpaces(data['Parking']) || parseGarageSpaces(data['Garage']);
    case 'driveway':
      return normalizeDriveway(data['Driveway']) || normalizeDriveway(data['Parking']);
    case 'drivewayParkingSpaces':
      return normalizeValue(data['Driveway Spaces']) || parseDrivewaySpaces(data['Parking']);
    case 'totalParkingSpaces':
      return normalizeValue(data['Total Parking Spaces']) || parseTotalParkingSpaces(data);
    case 'lotSizeCode':
      return normalizeLotSizeCode(data);
    case 'lotSizeSource':
      return data['PIN'] || data['Municipal Address'] ? 'GeoWarehouse' : undefined;
    case 'propertyType':
      return normalizePropertyType(data['Property Type']);
    case 'style':
      return normalizeStyle(data['Style']);
    case 'approxSquareFootage':
      return normalizeSquareFootageBucket(data['Square Footage']);
    case 'taxes':
      return normalizeValue(data['Taxes']);
    case 'taxYear':
      return normalizeValue(data['Tax Year']);
    default:
      return undefined;
  }
}

function normalizeValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeGarageType(value?: string): string | undefined {
  const normalized = value?.toLowerCase() ?? '';
  if (!normalized) return undefined;
  if (normalized.includes('built')) return 'built-in';
  if (normalized.includes('attached')) return 'attached';
  if (normalized.includes('detached')) return 'detached';
  if (normalized.includes('carport')) return 'carport';
  if (normalized.includes('none') || normalized.includes('no garage')) return 'none';
  return undefined;
}

function normalizeDriveway(value?: string): string | undefined {
  const normalized = value?.toLowerCase() ?? '';
  if (!normalized) return undefined;
  if (normalized.includes('private double')) return 'private double';
  if (normalized.includes('private triple')) return 'private triple';
  if (normalized.includes('front yard')) return 'front yard';
  if (normalized.includes('mutual')) return 'mutual';
  if (normalized.includes('lane')) return 'lane';
  if (normalized.includes('private')) return 'private';
  if (normalized.includes('none') || normalized.includes('no driveway')) return 'none';
  if (/\b\d+\s+drive\b/.test(normalized)) return 'private';
  return undefined;
}

function parseGarageSpaces(value?: string): string | undefined {
  return parseParkingCount(value, /(\d+(?:\.\d+)?)\s+garage/i);
}

function parseDrivewaySpaces(value?: string): string | undefined {
  return parseParkingCount(value, /(\d+(?:\.\d+)?)\s+drive/i);
}

function parseParkingCount(value: string | undefined, pattern: RegExp): string | undefined {
  const match = value?.match(pattern);
  return match?.[1];
}

function parseTotalParkingSpaces(data: Record<string, string>): string | undefined {
  const garageSpaces = parseFloat(data['Garage Spaces'] || parseGarageSpaces(data['Parking']) || parseGarageSpaces(data['Garage']) || '0');
  const drivewaySpaces = parseFloat(data['Driveway Spaces'] || parseDrivewaySpaces(data['Parking']) || '0');
  const total = garageSpaces + drivewaySpaces;

  if (!Number.isFinite(total) || total <= 0) {
    return undefined;
  }

  return Number.isInteger(total) ? String(total) : total.toFixed(1);
}

function normalizeLotSizeCode(data: Record<string, string>): string | undefined {
  const combined = `${data['Lot Size'] || ''} ${data['Lot Dimensions'] || ''}`.toLowerCase();
  if (combined.includes('acre')) return 'Acres';
  if (combined.includes('metre') || combined.includes('meter')) return 'Metres';
  if (combined.includes('ft') || combined.includes('feet') || data['Lot Frontage'] || data['Lot Depth']) return 'Feet';
  return undefined;
}

function normalizePropertyType(value?: string): string | undefined {
  const normalized = value?.toLowerCase() ?? '';
  if (!normalized) return undefined;
  if (normalized.includes('semi')) return 'Semi-Detached';
  if (normalized.includes('town') || normalized.includes('row')) return 'Att/Row/Townhouse';
  if (normalized.includes('detached')) return 'Detached';
  if (normalized.includes('duplex')) return 'Duplex';
  if (normalized.includes('triplex')) return 'Triplex';
  if (normalized.includes('fourplex')) return 'Fourplex';
  if (normalized.includes('multiplex')) return 'Multiplex';
  if (normalized.includes('cottage')) return 'Cottage';
  if (normalized.includes('farm')) return 'Farm';
  if (normalized.includes('link')) return 'Link';
  if (normalized.includes('modular')) return 'Modular Home';
  if (normalized.includes('rural')) return 'Rural Residential';
  if (normalized.includes('mobile') || normalized.includes('trailer')) return 'Mobile/Trailer';
  return undefined;
}

function normalizeStyle(value?: string): string | undefined {
  const normalized = value?.toLowerCase().replace(/[^a-z0-9/+]+/g, ' ') ?? '';
  if (!normalized.trim()) return undefined;

  const candidates: Array<{ pattern: RegExp; value: string }> = [
    { pattern: /\b1\s*1\/2\s*storey\b/, value: '1 1/2 Storey' },
    { pattern: /\b2\s*1\/2\s*storey\b/, value: '2 1/2 Storey' },
    { pattern: /\b2\s*storey\b/, value: '2 Storey' },
    { pattern: /\b3\s*storey\b/, value: '3 Storey' },
    { pattern: /\bbungalow raised\b/, value: 'Bungalow-Raised' },
    { pattern: /\bbungalow\b/, value: 'Bungalow' },
    { pattern: /\bbungaloft\b/, value: 'Bungaloft' },
    { pattern: /\bbacksplit\s*3\b/, value: 'Backsplit 3' },
    { pattern: /\bbacksplit\s*4\b/, value: 'Backsplit 4' },
    { pattern: /\bbacksplit\s*5\b/, value: 'Backsplit 5' },
    { pattern: /\bsidesplit\s*3\b/, value: 'Sidesplit 3' },
    { pattern: /\bsidesplit\s*4\b/, value: 'Sidesplit 4' },
    { pattern: /\bsidesplit\s*5\b/, value: 'Sidesplit 5' },
    { pattern: /\bsidesplit\b/, value: 'Sidesplit' },
    { pattern: /\bcontemporary\b/, value: 'Contemporary' },
    { pattern: /\bgarden house\b/, value: 'Garden House' },
    { pattern: /\blog\b/, value: 'Log' },
    { pattern: /\bchalet\b/, value: 'Chalet' },
  ];

  return candidates.find((candidate) => candidate.pattern.test(normalized))?.value;
}

function normalizeSquareFootageBucket(value?: string): string | undefined {
  const raw = (value || '').trim();
  if (!raw) return undefined;

  // Handle range values like "700-1100" by averaging the endpoints
  const rangeMatch = raw.match(/^(\d[\d,]*(?:\.\d+)?)\s*[-–]\s*(\d[\d,]*(?:\.\d+)?)$/);
  let parsed: number;
  if (rangeMatch) {
    const lo = parseFloat(rangeMatch[1]!.replace(/,/g, ''));
    const hi = parseFloat(rangeMatch[2]!.replace(/,/g, ''));
    parsed = (lo + hi) / 2;
  } else {
    parsed = parseFloat(raw.replace(/[^0-9.]/g, ''));
  }
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  if (parsed < 700) return 'Under 700';
  if (parsed <= 1100) return '700-1100';
  if (parsed <= 1500) return '1100-1500';
  if (parsed <= 2000) return '1500-2000';
  if (parsed <= 2500) return '2000-2500';
  if (parsed <= 3000) return '2500-3000';
  if (parsed <= 3500) return '3000-3500';
  if (parsed <= 5000) return '3500-5000';
  return '5000+';
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
