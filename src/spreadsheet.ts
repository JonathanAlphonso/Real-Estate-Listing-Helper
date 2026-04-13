import fs from 'fs/promises';
import path from 'path';
import { fieldMappings } from '../config/field-mappings.js';
import type { ComparableSale, GeowarehouseData, RealmData } from './types/property-data.js';
import { ensureDataDirectories, DATA_DIR } from './runtime.js';
import { buildInitialPropertyData } from './skyslope-data.js';

interface CsvRow {
  source: string;
  field: string;
  value: string;
}

export const propertyCsvSchema = {
  property: [
    fieldMappings.address.spreadsheetColumn,
    fieldMappings.city.spreadsheetColumn,
    fieldMappings.province.spreadsheetColumn,
    fieldMappings.postalCode.spreadsheetColumn,
    fieldMappings.county.spreadsheetColumn,
    fieldMappings.sellerName.spreadsheetColumn,
    fieldMappings.sellerEmail.spreadsheetColumn,
    fieldMappings.skyslopeFileUrl.spreadsheetColumn,
  ],
  realm: [
    fieldMappings.address.spreadsheetColumn,
    'MLS Number',
    fieldMappings.listPrice.spreadsheetColumn,
    'Sale Price',
    'Sale Date',
    fieldMappings.propertyType.spreadsheetColumn,
    fieldMappings.style.spreadsheetColumn,
    fieldMappings.bedrooms.spreadsheetColumn,
    fieldMappings.bathrooms.spreadsheetColumn,
    fieldMappings.squareFootage.spreadsheetColumn,
    fieldMappings.lotFrontage.spreadsheetColumn,
    fieldMappings.lotDepth.spreadsheetColumn,
    'Lot Size',
    fieldMappings.garage.spreadsheetColumn,
    fieldMappings.parking.spreadsheetColumn,
    fieldMappings.basement.spreadsheetColumn,
    fieldMappings.heating.spreadsheetColumn,
    fieldMappings.cooling.spreadsheetColumn,
    fieldMappings.taxes.spreadsheetColumn,
    fieldMappings.taxYear.spreadsheetColumn,
    'Prior Sale Price',
    'Prior Sale Date',
  ],
  geowarehouse: [
    fieldMappings.pin.spreadsheetColumn,
    fieldMappings.legalDescription.spreadsheetColumn,
    'Municipal Address',
    'Municipality',
    'Lot Dimensions',
    'Lot Area',
    'Registered Owners',
    'Assessed Value',
    'Assessment Year',
    'Property Class',
    'Land Registry Office',
    'Instrument Number',
    'Registration Date',
  ],
  generated: [
    fieldMappings.listingDescription.spreadsheetColumn,
  ],
} as const;

// Fields that MUST have values for a property run to be considered complete.
// Fields not listed here are still written to CSV but may be empty for some properties.
export const requiredPropertyCsvFields = {
  property: [
    fieldMappings.address.spreadsheetColumn,
    fieldMappings.city.spreadsheetColumn,
    fieldMappings.province.spreadsheetColumn,
    fieldMappings.postalCode.spreadsheetColumn,
  ],
  realm: [
    fieldMappings.address.spreadsheetColumn,
    fieldMappings.propertyType.spreadsheetColumn,
    fieldMappings.bedrooms.spreadsheetColumn,
    fieldMappings.bathrooms.spreadsheetColumn,
    fieldMappings.taxes.spreadsheetColumn,
    fieldMappings.taxYear.spreadsheetColumn,
    fieldMappings.garage.spreadsheetColumn,
    fieldMappings.basement.spreadsheetColumn,
    fieldMappings.heating.spreadsheetColumn,
    fieldMappings.cooling.spreadsheetColumn,
    // Lot Size, Square Footage, Lot Frontage, Lot Depth, MLS Number, List/Sale Price,
    // Sale Date, Style, Prior Sale, Parking are desirable but may be absent for older listings
  ],
  geowarehouse: [
    fieldMappings.pin.spreadsheetColumn,
    fieldMappings.legalDescription.spreadsheetColumn,
    'Municipal Address',
    'Municipality',
    'Registered Owners',
    // Lot Dimensions, Lot Area, Assessed Value, Assessment Year, Property Class,
    // Land Registry Office, Instrument Number, Registration Date are desirable but
    // may not be available from every Geowarehouse property panel
  ],
} as const;

export function getPropertyFolderPath(address: string): string {
  const sanitized = address
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 80);

  return path.join(DATA_DIR, 'properties', sanitized || 'property');
}

export function getOutputPath(address: string): string {
  return path.join(getPropertyFolderPath(address), 'property-data.csv');
}

export async function createWorkbook(address: string): Promise<{ filePath: string; created: boolean }> {
  ensureDataDirectories();

  const propertyDir = getPropertyFolderPath(address);
  const filePath = getOutputPath(address);

  await fs.mkdir(propertyDir, { recursive: true });
  const existingRows = await readRows(filePath);
  if (existingRows.length > 0) {
    await ensurePropertyRows(filePath, existingRows, address);
    return { filePath, created: false };
  }

  const rows = [
    ...buildSourceRows('property', buildInitialPropertyData(address)),
    ...buildSourceRows('realm', {}),
    ...buildSourceRows('geowarehouse', {}),
    ...buildSourceRows('generated', {}),
  ];

  await fs.writeFile(filePath, toCsv(rows));

  return { filePath, created: true };
}

export async function writeRealmData(filePath: string, data: RealmData): Promise<void> {
  const rows = [
    ...buildSourceRows('realm', {
      [fieldMappings.address.spreadsheetColumn]: data.address,
      'MLS Number': data.mlsNumber,
      [fieldMappings.listPrice.spreadsheetColumn]: data.listPrice,
      'Sale Price': data.salePrice,
      'Sale Date': data.saleDate,
      [fieldMappings.propertyType.spreadsheetColumn]: data.propertyType,
      [fieldMappings.style.spreadsheetColumn]: data.style,
      [fieldMappings.bedrooms.spreadsheetColumn]: data.bedrooms,
      [fieldMappings.bathrooms.spreadsheetColumn]: data.bathrooms,
      [fieldMappings.squareFootage.spreadsheetColumn]: data.squareFootage,
      [fieldMappings.lotFrontage.spreadsheetColumn]: data.lotFrontage,
      [fieldMappings.lotDepth.spreadsheetColumn]: data.lotDepth,
      'Lot Size': data.lotSize,
      [fieldMappings.garage.spreadsheetColumn]: data.garage,
      [fieldMappings.parking.spreadsheetColumn]: data.parking,
      [fieldMappings.basement.spreadsheetColumn]: data.basement,
      [fieldMappings.heating.spreadsheetColumn]: data.heating,
      [fieldMappings.cooling.spreadsheetColumn]: data.cooling,
      [fieldMappings.taxes.spreadsheetColumn]: data.taxes,
      [fieldMappings.taxYear.spreadsheetColumn]: data.taxYear,
      'Prior Sale Price': data.priorSalePrice,
      'Prior Sale Date': data.priorSaleDate,
    }),
    ...flattenComparables(data.comparables),
  ];

  await replaceSourceRows(filePath, 'realm', rows);
}

export async function writeGeowarehouseData(filePath: string, data: GeowarehouseData): Promise<void> {
  const rows = buildSourceRows('geowarehouse', {
    [fieldMappings.pin.spreadsheetColumn]: data.pin,
    [fieldMappings.legalDescription.spreadsheetColumn]: data.legalDescription,
    'Municipal Address': data.municipalAddress,
    'Municipality': data.municipality,
    'Lot Dimensions': data.lotDimensions,
    'Lot Area': data.lotArea,
    'Registered Owners': data.registeredOwners.join('; '),
    'Assessed Value': data.assessedValue,
    'Assessment Year': data.assessmentYear,
    'Property Class': data.propertyClass,
    'Land Registry Office': data.landRegistryOffice,
    'Instrument Number': data.instrumentNumber,
    'Registration Date': data.registrationDate,
  });

  await replaceSourceRows(filePath, 'geowarehouse', rows);
}

export async function writePropertyData(filePath: string, values: Partial<Record<string, unknown>>): Promise<void> {
  const existingRows = await readRows(filePath);
  const existingPropertyValues = new Map(
    existingRows
      .filter((row) => row.source === 'property')
      .map((row) => [row.field, row.value]),
  );

  const mergedValues = Object.fromEntries(
    propertyCsvSchema.property.map((field) => [
      field,
      Object.prototype.hasOwnProperty.call(values, field)
        ? values[field]
        : existingPropertyValues.get(field) ?? '',
    ]),
  );

  const rows = buildSourceRows('property', mergedValues);
  await replaceSourceRows(filePath, 'property', rows);
}

export async function readAllData(filePath: string): Promise<Record<string, string>> {
  const rows = await readRows(filePath);
  const data: Record<string, string> = {};

  for (const row of rows) {
    if (!row.field || !row.value.trim()) continue;
    data[row.field] = row.value;
  }

  return data;
}

export async function readAddressFromSpreadsheet(filePath: string): Promise<string | undefined> {
  const rows = await readRows(filePath);
  const propertyAddress = rows.find((row) =>
    row.field.trim().toLowerCase() === fieldMappings.address.spreadsheetColumn.toLowerCase()
  );

  return propertyAddress?.value.trim() || undefined;
}

export async function writeGeneratedField(filePath: string, field: string, value: string): Promise<void> {
  const generatedRow = row('generated', field, value);
  if (!generatedRow) {
    return;
  }

  await replaceSourceRows(filePath, 'generated', buildSourceRows('generated', {
    [field]: value,
  }));
}

export async function assertPropertyCsvComplete(filePath: string): Promise<void> {
  const rows = await readRows(filePath);
  const missing: string[] = [];

  for (const [source, fields] of Object.entries(requiredPropertyCsvFields)) {
    for (const field of fields) {
      const row = rows.find((candidate) => candidate.source === source && candidate.field === field);
      if (!row || !row.value.trim()) {
        missing.push(`${source}:${field}`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(`Property CSV is incomplete. Missing values for: ${missing.join(', ')}`);
  }
}

function row(source: string, field: string, value: unknown): CsvRow | null {
  return {
    source,
    field,
    value: value === undefined || value === null ? '' : normalizeText(String(value)),
  };
}

/**
 * Normalize scraped text to plain ASCII-safe content for CSV.
 * Prevents mojibake from non-ASCII characters like ², ™, smart quotes, etc.
 */
function normalizeText(text: string): string {
  return text
    .replace(/\u00B2/g, '2')           // ² → 2
    .replace(/\u00B3/g, '3')           // ³ → 3
    .replace(/\u00B9/g, '1')           // ¹ → 1
    .replace(/[\u2018\u2019\u201A]/g, "'")  // smart single quotes → '
    .replace(/[\u201C\u201D\u201E]/g, '"')  // smart double quotes → "
    .replace(/\u2013/g, '-')           // en-dash → -
    .replace(/\u2014/g, '-')           // em-dash → -
    .replace(/\u2026/g, '...')         // ellipsis → ...
    .replace(/\u00A0/g, ' ')           // non-breaking space → space
    .replace(/\u2122/g, '(TM)')       // ™ → (TM)
    .replace(/\u00AE/g, '(R)')        // ® → (R)
    .replace(/\u00BD/g, '1/2')        // ½ → 1/2
    .replace(/\u00BC/g, '1/4')        // ¼ → 1/4
    .replace(/\u00BE/g, '3/4');        // ¾ → 3/4
}

function flattenComparables(comparables: ComparableSale[]): CsvRow[] {
  return comparables.flatMap((comp, index) => {
    const position = index + 1;
    return [
      row('realm', `Comparable ${position} Address`, comp.address),
      row('realm', `Comparable ${position} Sale Price`, comp.salePrice),
      row('realm', `Comparable ${position} Sale Date`, comp.saleDate),
      row('realm', `Comparable ${position} Bedrooms`, comp.bedrooms),
      row('realm', `Comparable ${position} Bathrooms`, comp.bathrooms),
      row('realm', `Comparable ${position} Square Footage`, comp.squareFootage),
      row('realm', `Comparable ${position} Lot Size`, comp.lotSize),
      row('realm', `Comparable ${position} Property Type`, comp.propertyType),
      row('realm', `Comparable ${position} Days On Market`, comp.daysOnMarket),
    ].filter((item): item is CsvRow => item !== null);
  });
}

async function replaceSourceRows(filePath: string, source: string, replacementRows: CsvRow[]): Promise<void> {
  const rows = await readRows(filePath);
  const retainedRows = rows.filter((row) => row.source !== source);
  const propertyRows = retainedRows.filter((row) => row.source === 'property');
  const merged = [...propertyRows, ...retainedRows.filter((row) => row.source !== 'property'), ...replacementRows];
  await fs.writeFile(filePath, toCsv(merged));
}

async function ensurePropertyRows(filePath: string, rows: CsvRow[], address: string): Promise<void> {
  const propertyRows = rows.filter((row) => row.source === 'property');
  const initialPropertyData = buildInitialPropertyData(address);
  const missingFields = propertyCsvSchema.property.filter((field) =>
    !propertyRows.some((row) => row.field === field)
  );

  const hasPropertyAddress = propertyRows.some((row) =>
    row.field === fieldMappings.address.spreadsheetColumn && row.value.trim().length > 0
  );

  if (missingFields.length === 0 && hasPropertyAddress) {
    return;
  }

  const propertyFieldMap = new Map(propertyRows.map((row) => [row.field, row]));
  const merged = [
    ...propertyCsvSchema.property.map((field) => {
      if (field === fieldMappings.address.spreadsheetColumn) {
        return row('property', field, propertyFieldMap.get(field)?.value || address)!;
      }

      return propertyFieldMap.get(field) ?? row('property', field, initialPropertyData[field])!;
    }),
    ...rows.filter((candidate) => candidate.source !== 'property'),
  ];
  await fs.writeFile(filePath, toCsv(merged));
}

function buildSourceRows(
  source: keyof typeof propertyCsvSchema,
  values: Partial<Record<string, unknown>>
): CsvRow[] {
  return propertyCsvSchema[source].map((field) => row(source, field, values[field])!);
}

async function readRows(filePath: string): Promise<CsvRow[]> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return parseCsv(content);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

function toCsv(rows: CsvRow[]): string {
  const lines = [
    ['source', 'field', 'value'],
    ...rows.map((row) => [row.source, row.field, row.value]),
  ];

  return `${lines.map((line) => line.map(escapeCsvValue).join(',')).join('\n')}\n`;
}

function escapeCsvValue(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function parseCsv(content: string): CsvRow[] {
  const rows = parseCsvLines(content.trim());
  if (rows.length === 0) {
    return [];
  }

  const [header, ...dataRows] = rows;
  const sourceIndex = header.findIndex((column) => column === 'source');
  const fieldIndex = header.findIndex((column) => column === 'field');
  const valueIndex = header.findIndex((column) => column === 'value');

  if (sourceIndex === -1 || fieldIndex === -1 || valueIndex === -1) {
    return [];
  }

  return dataRows
    .filter((row) => row.length > 0)
    .map((row) => ({
      source: row[sourceIndex] ?? '',
      field: row[fieldIndex] ?? '',
      value: row[valueIndex] ?? '',
    }));
}

function parseCsvLines(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if (char === '\n' && !inQuotes) {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      continue;
    }

    currentField += char;
  }

  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}
