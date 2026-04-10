// Maps canonical field names to spreadsheet column headers and SkySlope form selectors.
// This is the single source of truth for data flow: Spreadsheet <-> Form fields.

export interface FieldMapping {
  spreadsheetColumn: string;
  form271Selector: string | null;
  form290Selector: string | null;
}

export const fieldMappings: Record<string, FieldMapping> = {
  // Property identification
  address: {
    spreadsheetColumn: 'Property Address',
    form271Selector: 'propertyAddress',
    form290Selector: 'address',
  },
  city: {
    spreadsheetColumn: 'City',
    form271Selector: null,
    form290Selector: 'city',
  },
  postalCode: {
    spreadsheetColumn: 'Postal Code',
    form271Selector: null,
    form290Selector: 'postalCode',
  },
  legalDescription: {
    spreadsheetColumn: 'Legal Description',
    form271Selector: 'legalDescription',
    form290Selector: 'legalDescription',
  },
  pin: {
    spreadsheetColumn: 'PIN',
    form271Selector: null,
    form290Selector: 'pin',
  },

  // Pricing
  listPrice: {
    spreadsheetColumn: 'List Price',
    form271Selector: 'listPrice',
    form290Selector: 'listPrice',
  },

  // Seller info
  sellerName: {
    spreadsheetColumn: 'Seller Name',
    form271Selector: 'sellerName',
    form290Selector: null,
  },

  // Property details
  propertyType: {
    spreadsheetColumn: 'Property Type',
    form271Selector: null,
    form290Selector: 'propertyType',
  },
  style: {
    spreadsheetColumn: 'Style',
    form271Selector: null,
    form290Selector: 'style',
  },
  bedrooms: {
    spreadsheetColumn: 'Bedrooms',
    form271Selector: null,
    form290Selector: 'bedrooms',
  },
  bathrooms: {
    spreadsheetColumn: 'Bathrooms',
    form271Selector: null,
    form290Selector: 'bathrooms',
  },
  squareFootage: {
    spreadsheetColumn: 'Square Footage',
    form271Selector: null,
    form290Selector: 'squareFootage',
  },
  lotFrontage: {
    spreadsheetColumn: 'Lot Frontage',
    form271Selector: null,
    form290Selector: 'lotFrontage',
  },
  lotDepth: {
    spreadsheetColumn: 'Lot Depth',
    form271Selector: null,
    form290Selector: 'lotDepth',
  },
  yearBuilt: {
    spreadsheetColumn: 'Year Built',
    form271Selector: null,
    form290Selector: 'yearBuilt',
  },
  garage: {
    spreadsheetColumn: 'Garage',
    form271Selector: null,
    form290Selector: 'garage',
  },
  parking: {
    spreadsheetColumn: 'Parking',
    form271Selector: null,
    form290Selector: 'parking',
  },
  basement: {
    spreadsheetColumn: 'Basement',
    form271Selector: null,
    form290Selector: 'basement',
  },
  heating: {
    spreadsheetColumn: 'Heating',
    form271Selector: null,
    form290Selector: 'heating',
  },
  cooling: {
    spreadsheetColumn: 'Cooling',
    form271Selector: null,
    form290Selector: 'cooling',
  },
  taxes: {
    spreadsheetColumn: 'Taxes',
    form271Selector: null,
    form290Selector: 'taxes',
  },
  taxYear: {
    spreadsheetColumn: 'Tax Year',
    form271Selector: null,
    form290Selector: 'taxYear',
  },

  // Generated
  listingDescription: {
    spreadsheetColumn: 'Listing Description',
    form271Selector: null,
    form290Selector: 'listingDescription',
  },
};
