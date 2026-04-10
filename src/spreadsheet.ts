import ExcelJS from 'exceljs';
import path from 'path';
import { fieldMappings } from '../config/field-mappings.js';
import type { RealmData, GeowarehouseData, ComparableSale } from './types/property-data.js';
import { ensureDataDirectories, DATA_DIR } from './runtime.js';

export function getOutputPath(address: string): string {
  const sanitized = address.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
  return path.join(DATA_DIR, `${sanitized}_${Date.now()}.xlsx`);
}

export async function createWorkbook(address: string): Promise<{ workbook: ExcelJS.Workbook; filePath: string }> {
  ensureDataDirectories();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Real Estate Listing Helper';
  workbook.created = new Date();

  // Create the main PropertyData sheet with column headers from field mappings
  const mainSheet = workbook.addWorksheet('PropertyData');
  const columns = Object.values(fieldMappings).map((m) => ({
    header: m.spreadsheetColumn,
    key: m.spreadsheetColumn,
    width: 20,
  }));
  mainSheet.columns = columns;

  // Bold headers
  mainSheet.getRow(1).font = { bold: true };

  // Create Realm sheet
  workbook.addWorksheet('Realm');

  // Create Geowarehouse sheet
  workbook.addWorksheet('Geowarehouse');

  // Create Comparables sheet
  workbook.addWorksheet('Comparables');

  const filePath = getOutputPath(address);
  await workbook.xlsx.writeFile(filePath);

  return { workbook, filePath };
}

export async function writeRealmData(filePath: string, data: RealmData): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // Write to Realm detail sheet
  const realmSheet = workbook.getWorksheet('Realm')!;
  realmSheet.columns = [
    { header: 'Field', key: 'field', width: 25 },
    { header: 'Value', key: 'value', width: 40 },
  ];
  realmSheet.getRow(1).font = { bold: true };

  const realmFields: [string, unknown][] = [
    ['Address', data.address],
    ['MLS Number', data.mlsNumber],
    ['List Price', data.listPrice],
    ['Sale Price', data.salePrice],
    ['Sale Date', data.saleDate],
    ['Property Type', data.propertyType],
    ['Style', data.style],
    ['Bedrooms', data.bedrooms],
    ['Bathrooms', data.bathrooms],
    ['Square Footage', data.squareFootage],
    ['Lot Frontage', data.lotFrontage],
    ['Lot Depth', data.lotDepth],
    ['Lot Size', data.lotSize],
    ['Year Built', data.yearBuilt],
    ['Garage', data.garage],
    ['Parking', data.parking],
    ['Basement', data.basement],
    ['Heating', data.heating],
    ['Cooling', data.cooling],
    ['Taxes', data.taxes],
    ['Tax Year', data.taxYear],
    ['Prior Sale Price', data.priorSalePrice],
    ['Prior Sale Date', data.priorSaleDate],
  ];

  for (const [field, value] of realmFields) {
    if (value !== undefined && value !== null) {
      realmSheet.addRow({ field, value: String(value) });
    }
  }

  // Write comparables to Comparables sheet
  if (data.comparables.length > 0) {
    const compSheet = workbook.getWorksheet('Comparables')!;
    compSheet.columns = [
      { header: 'Address', key: 'address', width: 35 },
      { header: 'Sale Price', key: 'salePrice', width: 15 },
      { header: 'Sale Date', key: 'saleDate', width: 15 },
      { header: 'Bedrooms', key: 'bedrooms', width: 10 },
      { header: 'Bathrooms', key: 'bathrooms', width: 10 },
      { header: 'Sq Ft', key: 'squareFootage', width: 10 },
      { header: 'Lot Size', key: 'lotSize', width: 15 },
      { header: 'Type', key: 'propertyType', width: 15 },
      { header: 'DOM', key: 'daysOnMarket', width: 8 },
    ];
    compSheet.getRow(1).font = { bold: true };

    for (const comp of data.comparables) {
      compSheet.addRow(comp);
    }
  }

  // Also populate the main PropertyData sheet
  const mainSheet = workbook.getWorksheet('PropertyData')!;
  const dataRow: Record<string, unknown> = {};
  dataRow[fieldMappings.address.spreadsheetColumn] = data.address;
  dataRow[fieldMappings.propertyType.spreadsheetColumn] = data.propertyType;
  dataRow[fieldMappings.style.spreadsheetColumn] = data.style;
  dataRow[fieldMappings.bedrooms.spreadsheetColumn] = data.bedrooms;
  dataRow[fieldMappings.bathrooms.spreadsheetColumn] = data.bathrooms;
  dataRow[fieldMappings.squareFootage.spreadsheetColumn] = data.squareFootage;
  dataRow[fieldMappings.lotFrontage.spreadsheetColumn] = data.lotFrontage;
  dataRow[fieldMappings.lotDepth.spreadsheetColumn] = data.lotDepth;
  dataRow[fieldMappings.yearBuilt.spreadsheetColumn] = data.yearBuilt;
  dataRow[fieldMappings.garage.spreadsheetColumn] = data.garage;
  dataRow[fieldMappings.parking.spreadsheetColumn] = data.parking;
  dataRow[fieldMappings.basement.spreadsheetColumn] = data.basement;
  dataRow[fieldMappings.heating.spreadsheetColumn] = data.heating;
  dataRow[fieldMappings.cooling.spreadsheetColumn] = data.cooling;
  dataRow[fieldMappings.taxes.spreadsheetColumn] = data.taxes;
  dataRow[fieldMappings.taxYear.spreadsheetColumn] = data.taxYear;
  mainSheet.addRow(dataRow);

  await workbook.xlsx.writeFile(filePath);
}

export async function writeGeowarehouseData(filePath: string, data: GeowarehouseData): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // Write to Geowarehouse detail sheet
  const geoSheet = workbook.getWorksheet('Geowarehouse')!;
  geoSheet.columns = [
    { header: 'Field', key: 'field', width: 25 },
    { header: 'Value', key: 'value', width: 50 },
  ];
  geoSheet.getRow(1).font = { bold: true };

  const geoFields: [string, unknown][] = [
    ['PIN', data.pin],
    ['Legal Description', data.legalDescription],
    ['Municipal Address', data.municipalAddress],
    ['Municipality', data.municipality],
    ['Lot Dimensions', data.lotDimensions],
    ['Lot Area', data.lotArea],
    ['Registered Owners', data.registeredOwners.join('; ')],
    ['Assessed Value', data.assessedValue],
    ['Assessment Year', data.assessmentYear],
    ['Property Class', data.propertyClass],
    ['Land Registry Office', data.landRegistryOffice],
    ['Instrument Number', data.instrumentNumber],
    ['Registration Date', data.registrationDate],
  ];

  for (const [field, value] of geoFields) {
    if (value !== undefined && value !== null) {
      geoSheet.addRow({ field, value: String(value) });
    }
  }

  // Update the main PropertyData sheet with Geowarehouse fields
  const mainSheet = workbook.getWorksheet('PropertyData')!;
  // Update row 2 (first data row) with geo fields
  const row = mainSheet.getRow(2);
  const colMap = new Map<string, number>();
  mainSheet.getRow(1).eachCell((cell, colNumber) => {
    colMap.set(String(cell.value), colNumber);
  });

  const updates: Record<string, unknown> = {
    [fieldMappings.legalDescription.spreadsheetColumn]: data.legalDescription,
    [fieldMappings.pin.spreadsheetColumn]: data.pin,
  };

  for (const [colName, value] of Object.entries(updates)) {
    const colNum = colMap.get(colName);
    if (colNum) {
      row.getCell(colNum).value = value as ExcelJS.CellValue;
    }
  }

  row.commit();
  await workbook.xlsx.writeFile(filePath);
}

export async function readAllData(filePath: string): Promise<Record<string, string>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const mainSheet = workbook.getWorksheet('PropertyData')!;
  const headers: string[] = [];
  mainSheet.getRow(1).eachCell((cell) => {
    headers.push(String(cell.value));
  });

  const data: Record<string, string> = {};
  const dataRow = mainSheet.getRow(2);
  headers.forEach((header, index) => {
    const value = dataRow.getCell(index + 1).value;
    if (value !== null && value !== undefined) {
      data[header] = String(value);
    }
  });

  return data;
}

export async function readAddressFromSpreadsheet(filePath: string): Promise<string | undefined> {
  const data = await readAllData(filePath);
  const address = data[fieldMappings.address.spreadsheetColumn]?.trim();
  return address || undefined;
}
