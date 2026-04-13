import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  assertPropertyCsvComplete,
  createWorkbook,
  getPropertyFolderPath,
  readAllData,
  writeGeneratedField,
  writeGeowarehouseData,
  writePropertyData,
  writeRealmData,
} from '../src/spreadsheet.js';
import type { GeowarehouseData, RealmData } from '../src/types/property-data.js';

test('a fresh property CSV is incomplete and fails validation', async (t) => {
  const address = '999 TDD Incomplete Ave, Toronto, Ontario, M5V 1A1';
  const propertyDir = getPropertyFolderPath(address);
  await fs.rm(propertyDir, { recursive: true, force: true });
  t.after(async () => {
    await fs.rm(propertyDir, { recursive: true, force: true });
  });

  const { filePath } = await createWorkbook(address);

  await assert.rejects(
    () => assertPropertyCsvComplete(filePath),
    /Property CSV is incomplete/
  );
});

test('createWorkbook reuses an existing property CSV instead of wiping prior data', async (t) => {
  const address = '999 TDD Resume Ave, Toronto, Ontario, M5V 1A3';
  const propertyDir = getPropertyFolderPath(address);
  await fs.rm(propertyDir, { recursive: true, force: true });
  t.after(async () => {
    await fs.rm(propertyDir, { recursive: true, force: true });
  });

  const firstWorkbook = await createWorkbook(address);
  const realmData: RealmData = {
    address,
    mlsNumber: 'TREB-RG9999',
    propertyType: 'Detached',
    bedrooms: 3,
    bathrooms: 2,
    garage: 'Attached',
    basement: 'Finished',
    heating: 'Forced Air',
    cooling: 'Central Air',
    taxes: 4100,
    taxYear: '2025',
    comparables: [],
  };

  await writeRealmData(firstWorkbook.filePath, realmData);
  await writeGeneratedField(firstWorkbook.filePath, 'Listing Description', 'Existing description');

  const secondWorkbook = await createWorkbook(address);
  const allData = await readAllData(secondWorkbook.filePath);

  assert.equal(firstWorkbook.filePath, secondWorkbook.filePath);
  assert.equal(secondWorkbook.created, false);
  assert.equal(allData['MLS Number'], 'TREB-RG9999');
  assert.equal(allData['Listing Description'], 'Existing description');
});

test('writePropertyData merges partial property updates without blanking existing rows', async (t) => {
  const address = '999 TDD Property Merge Ave, Toronto, Ontario, M5V 1A4';
  const propertyDir = getPropertyFolderPath(address);
  await fs.rm(propertyDir, { recursive: true, force: true });
  t.after(async () => {
    await fs.rm(propertyDir, { recursive: true, force: true });
  });

  const { filePath } = await createWorkbook(address);
  await writePropertyData(filePath, {
    'Seller Email': 'seller@example.com',
    'County': 'Toronto',
  });
  await writePropertyData(filePath, {
    'SkySlope File URL': 'https://forms.skyslope.com/file/123/documents',
  });

  const allData = await readAllData(filePath);
  assert.equal(allData['Seller Email'], 'seller@example.com');
  assert.equal(allData['County'], 'Toronto');
  assert.equal(allData['SkySlope File URL'], 'https://forms.skyslope.com/file/123/documents');
  assert.equal(allData['Property Address'], address);
});

test('a property CSV passes validation only after realm and geowarehouse fields are fully populated', async (t) => {
  const address = '999 TDD Complete Ave, Toronto, Ontario, M5V 1A2';
  const propertyDir = getPropertyFolderPath(address);
  await fs.rm(propertyDir, { recursive: true, force: true });
  t.after(async () => {
    await fs.rm(propertyDir, { recursive: true, force: true });
  });

  const { filePath } = await createWorkbook(address);

  const realmData: RealmData = {
    address,
    mlsNumber: 'TREB-RG0443',
    listPrice: 319000,
    salePrice: 305000,
    saleDate: '1998-08-13',
    propertyType: 'Detached',
    style: '2-Storey',
    bedrooms: 4,
    bathrooms: 3,
    squareFootage: '1800',
    lotFrontage: '45',
    lotDepth: '120',
    lotSize: '45 x 120',
    garage: 'Attached',
    parking: '2 garage, 2 drive',
    basement: 'Finished',
    heating: 'Forced Air',
    cooling: 'Central Air',
    taxes: 4172.47,
    taxYear: '1997',
    priorSalePrice: 305000,
    priorSaleDate: '1998-08-13',
    comparables: [],
  };

  const geowarehouseData: GeowarehouseData = {
    pin: '12345-6789',
    legalDescription: 'PLAN M123 LOT 45',
    municipalAddress: address,
    municipality: 'Toronto',
    lotDimensions: '45 x 120',
    lotArea: '5400',
    registeredOwners: ['John Doe', 'Jane Doe'],
    assessedValue: 850000,
    assessmentYear: '2025',
    propertyClass: 'Residential',
    landRegistryOffice: 'Toronto',
    instrumentNumber: 'AT1234567',
    registrationDate: '2020-02-20',
  };

  await writeRealmData(filePath, realmData);

  await assert.rejects(
    () => assertPropertyCsvComplete(filePath),
    /geowarehouse:PIN/
  );

  await writeGeowarehouseData(filePath, geowarehouseData);
  await assert.doesNotReject(() => assertPropertyCsvComplete(filePath));

  await writeGeneratedField(filePath, 'Listing Description', 'Test generated description');

  const allData = await readAllData(filePath);
  assert.equal(allData['Property Address'], address);
  assert.equal(allData['PIN'], geowarehouseData.pin);
  assert.equal(allData['MLS Number'], realmData.mlsNumber);
  assert.equal(allData['Listing Description'], 'Test generated description');
});
