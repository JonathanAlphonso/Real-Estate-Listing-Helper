import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInitialPropertyData,
  inferCounty,
  parseAddressForSkySlope,
  parsePrimaryContact,
  resolveSkySlopeFieldValue,
} from '../src/skyslope-data.js';
import { fieldMappings } from '../config/field-mappings.js';

test('parseAddressForSkySlope normalizes Ontario addresses', () => {
  assert.deepEqual(
    parseAddressForSkySlope('9 Lanewood Cres, Scarborough, Ontario, M1W 1W9'),
    {
      street: '9 Lanewood Cres',
      city: 'Scarborough',
      province: 'ON',
      postalCode: 'M1W 1W9',
    },
  );
});

test('parseAddressForSkySlope handles non-Toronto GTA addresses without commas', () => {
  assert.deepEqual(
    parseAddressForSkySlope('1 Jacobs Square Brampton, ON L6S 2M4'),
    {
      street: '1 Jacobs Square',
      city: 'Brampton',
      province: 'ON',
      postalCode: 'L6S 2M4',
    },
  );
});

test('buildInitialPropertyData seeds first-class property rows', () => {
  const initial = buildInitialPropertyData('9 Lanewood Cres, Scarborough, Ontario, M1W 1W9');

  assert.equal(initial[fieldMappings.city.spreadsheetColumn], 'Scarborough');
  assert.equal(initial[fieldMappings.province.spreadsheetColumn], 'ON');
  assert.equal(initial[fieldMappings.postalCode.spreadsheetColumn], 'M1W 1W9');
  assert.equal(initial[fieldMappings.county.spreadsheetColumn], 'Toronto');
  assert.equal(initial[fieldMappings.sellerEmail.spreadsheetColumn], '');
});

test('inferCounty maps common GTA municipalities', () => {
  assert.equal(inferCounty('Scarborough'), 'Toronto');
  assert.equal(inferCounty('Brampton'), 'Peel');
  assert.equal(inferCounty('Markham'), 'York');
  assert.equal(inferCounty('Whitby'), 'Durham');
  assert.equal(inferCounty('Oakville'), 'Halton');
});

test('parsePrimaryContact handles reversed owner names', () => {
  assert.deepEqual(parsePrimaryContact('DOE, JANE'), {
    firstName: 'JANE',
    lastName: 'DOE',
  });
});

test('resolveSkySlopeFieldValue derives normalized 290 values from legacy CSV data', () => {
  const data = {
    Garage: 'Attached',
    Parking: '2 garage, 2 drive',
    Style: '2-Storey',
    'Property Type': 'Detached',
    'Square Footage': '1850',
    City: 'Scarborough',
    Municipality: 'Toronto',
    PIN: '12345-6789',
  };

  assert.deepEqual(resolveSkySlopeFieldValue('garageType', data), {
    source: 'derived',
    value: 'attached',
  });
  assert.deepEqual(resolveSkySlopeFieldValue('garageParkingSpaces', data), {
    source: 'derived',
    value: '2',
  });
  assert.deepEqual(resolveSkySlopeFieldValue('driveway', data), {
    source: 'derived',
    value: 'private',
  });
  assert.deepEqual(resolveSkySlopeFieldValue('totalParkingSpaces', data), {
    source: 'derived',
    value: '4',
  });
  assert.deepEqual(resolveSkySlopeFieldValue('approxSquareFootage', data), {
    source: 'derived',
    value: '1500-2000',
  });
  assert.deepEqual(resolveSkySlopeFieldValue('lotSizeSource', data), {
    source: 'derived',
    value: 'GeoWarehouse',
  });
});
