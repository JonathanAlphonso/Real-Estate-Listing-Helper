// Maps canonical field names to spreadsheet column headers and SkySlope form selectors.
// This is the single source of truth for data flow: Spreadsheet <-> Form fields.
//
// For Form 290, there are two types of fields:
//   - 'text'     → filled via locator.fill(). The form290Selector key looks up
//                   the CSS selector in skyslopeSelectors.form290Text.
//   - 'checkbox' → the data value is matched against a lookup table in
//                   skyslopeSelectors.form290Checkboxes[selectorKey].
//
// The `form290Type` property tells step 07 which strategy to use.

export interface FieldMapping {
  spreadsheetColumn: string;
  form271Selector: string | null;
  form290Selector: string | null;
  /** 'text' (default) or 'checkbox' — only relevant for form 290. */
  form290Type?: 'text' | 'checkbox';
}

export const fieldMappings: Record<string, FieldMapping> = {
  // ── Property identification ────────────────────────────────────────────
  address: {
    spreadsheetColumn: 'Property Address',
    form271Selector: 'propertyAddress',
    form290Selector: null, // auto-populated from file creation
  },
  city: {
    spreadsheetColumn: 'City',
    form271Selector: null,
    form290Selector: null, // auto-populated from file creation
  },
  province: {
    spreadsheetColumn: 'Province',
    form271Selector: null,
    form290Selector: null, // auto-populated from file creation
  },
  postalCode: {
    spreadsheetColumn: 'Postal Code',
    form271Selector: null,
    form290Selector: null, // auto-populated from file creation
  },
  county: {
    spreadsheetColumn: 'County',
    form271Selector: null,
    form290Selector: null, // only used on create-file page
  },
  legalDescription: {
    spreadsheetColumn: 'Legal Description',
    form271Selector: 'legalDescription',
    form290Selector: null, // no editable input on current 290 template
  },
  pin: {
    spreadsheetColumn: 'PIN',
    form271Selector: null,
    form290Selector: 'pin',
  },
  additionalPin: {
    spreadsheetColumn: 'Additional PIN',
    form271Selector: null,
    form290Selector: 'additionalPin',
  },

  // ── Location ───────────────────────────────────────────────────────────
  assessorRoll: {
    spreadsheetColumn: 'Assessment Roll',
    form271Selector: null,
    form290Selector: 'assessorRoll',
  },
  area: {
    spreadsheetColumn: 'Area',
    form271Selector: null,
    form290Selector: 'area',
  },
  municipality: {
    spreadsheetColumn: 'Municipality',
    form271Selector: null,
    form290Selector: 'municipality',
  },
  community: {
    spreadsheetColumn: 'Community',
    form271Selector: null,
    form290Selector: 'community',
  },

  // ── Pricing ────────────────────────────────────────────────────────────
  listPrice: {
    spreadsheetColumn: 'List Price',
    form271Selector: 'listPrice',
    form290Selector: 'listPrice',
  },

  // ── Seller info ────────────────────────────────────────────────────────
  sellerName: {
    spreadsheetColumn: 'Seller Name',
    form271Selector: 'sellerName',
    form290Selector: null,
  },
  sellerEmail: {
    spreadsheetColumn: 'Seller Email',
    form271Selector: null,
    form290Selector: null,
  },
  skyslopeFileUrl: {
    spreadsheetColumn: 'SkySlope File URL',
    form271Selector: null,
    form290Selector: null,
  },

  // ── Lot dimensions ─────────────────────────────────────────────────────
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
  lotSizeCode: {
    spreadsheetColumn: 'Lot Size Code',
    form271Selector: null,
    form290Selector: 'lotSizeCode',
    form290Type: 'checkbox',
  },
  lotShape: {
    spreadsheetColumn: 'Lot Shape',
    form271Selector: null,
    form290Selector: 'lotShape',
    form290Type: 'checkbox',
  },
  lotSizeSource: {
    spreadsheetColumn: 'Lot Size Source',
    form271Selector: null,
    form290Selector: 'lotSizeSource',
    form290Type: 'checkbox',
  },

  // ── Property flags ─────────────────────────────────────────────────────
  winterized: {
    spreadsheetColumn: 'Winterized',
    form271Selector: null,
    form290Selector: 'winterized',
    form290Type: 'checkbox',
  },
  hst: {
    spreadsheetColumn: 'HST',
    form271Selector: null,
    form290Selector: 'hst',
    form290Type: 'checkbox',
  },
  developmentCharges: {
    spreadsheetColumn: 'Development Charges',
    form271Selector: null,
    form290Selector: 'developmentCharges',
    form290Type: 'checkbox',
  },

  // ── Taxes & assessment ─────────────────────────────────────────────────
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
  assessmentValue: {
    spreadsheetColumn: 'Assessment Value',
    form271Selector: null,
    form290Selector: 'assessmentValue',
  },
  assessmentYear: {
    spreadsheetColumn: 'Assessment Year',
    form271Selector: null,
    form290Selector: 'assessmentYear',
  },

  // ── Possession ─────────────────────────────────────────────────────────
  possession: {
    spreadsheetColumn: 'Possession',
    form271Selector: null,
    form290Selector: 'possession',
    form290Type: 'checkbox',
  },

  // ── Property details (checkbox-based) ──────────────────────────────────
  propertyType: {
    spreadsheetColumn: 'Property Type',
    form271Selector: null,
    form290Selector: 'propertyType',
    form290Type: 'checkbox',
  },
  style: {
    spreadsheetColumn: 'Style',
    form271Selector: null,
    form290Selector: 'style',
    form290Type: 'checkbox',
  },
  exterior: {
    spreadsheetColumn: 'Exterior',
    form271Selector: null,
    form290Selector: 'exterior',
    form290Type: 'checkbox',
  },

  // ── Garage & parking ───────────────────────────────────────────────────
  garageType: {
    spreadsheetColumn: 'Garage Type',
    form271Selector: null,
    form290Selector: 'garageType',
    form290Type: 'checkbox',
  },
  garageParkingSpaces: {
    spreadsheetColumn: 'Garage Spaces',
    form271Selector: null,
    form290Selector: 'garageParkingSpaces',
  },
  driveway: {
    spreadsheetColumn: 'Driveway',
    form271Selector: null,
    form290Selector: 'driveway',
    form290Type: 'checkbox',
  },
  drivewayParkingSpaces: {
    spreadsheetColumn: 'Driveway Spaces',
    form271Selector: null,
    form290Selector: 'drivewayParkingSpaces',
  },
  totalParkingSpaces: {
    spreadsheetColumn: 'Total Parking Spaces',
    form271Selector: null,
    form290Selector: 'totalParkingSpaces',
  },

  // ── Utilities ──────────────────────────────────────────────────────────
  water: {
    spreadsheetColumn: 'Water',
    form271Selector: null,
    form290Selector: 'water',
    form290Type: 'checkbox',
  },
  sewers: {
    spreadsheetColumn: 'Sewers',
    form271Selector: null,
    form290Selector: 'sewers',
    form290Type: 'checkbox',
  },

  // ── Building details ───────────────────────────────────────────────────
  yearBuilt: {
    spreadsheetColumn: 'Year Built',
    form271Selector: null,
    form290Selector: 'yearBuilt',
  },
  approxSquareFootage: {
    spreadsheetColumn: 'Approx Square Footage',
    form271Selector: null,
    form290Selector: 'approxSquareFootage',
    form290Type: 'checkbox',
  },

  // ── Legacy fields (kept for spreadsheet compatibility) ─────────────────
  bedrooms: {
    spreadsheetColumn: 'Bedrooms',
    form271Selector: null,
    form290Selector: null, // not on current 4-page 290 template
  },
  bathrooms: {
    spreadsheetColumn: 'Bathrooms',
    form271Selector: null,
    form290Selector: null, // not on current 4-page 290 template
  },
  squareFootage: {
    spreadsheetColumn: 'Square Footage',
    form271Selector: null,
    form290Selector: null, // use approxSquareFootage checkbox range instead
  },
  garage: {
    spreadsheetColumn: 'Garage',
    form271Selector: null,
    form290Selector: null, // split into garageType + garageParkingSpaces
  },
  parking: {
    spreadsheetColumn: 'Parking',
    form271Selector: null,
    form290Selector: null, // split into driveway + totalParkingSpaces
  },
  basement: {
    spreadsheetColumn: 'Basement',
    form271Selector: null,
    form290Selector: null, // not on current 4-page 290 template
  },
  heating: {
    spreadsheetColumn: 'Heating',
    form271Selector: null,
    form290Selector: null, // not on current 4-page 290 template
  },
  cooling: {
    spreadsheetColumn: 'Cooling',
    form271Selector: null,
    form290Selector: null, // not on current 4-page 290 template
  },

  // ── Generated content ──────────────────────────────────────────────────
  listingDescription: {
    spreadsheetColumn: 'Listing Description',
    form271Selector: null,
    form290Selector: null, // not on current 4-page 290 template
  },
};
