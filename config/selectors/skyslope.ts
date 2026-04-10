// SkySlope Forms DOM selectors — placeholders.
// Use `npm run start -- --debug` and Playwright Inspector to discover actual selectors.

export const skyslopeSelectors = {
  // Login
  postLoginIndicator: '.dashboard, .main-content, [data-testid="dashboard"], a:has-text("Logout")',

  // Transaction creation
  newTransactionButton: 'button:has-text("New"), button:has-text("Create"), [data-testid="new-transaction"]',
  transactionTypeSelect: 'select[name="type"], [data-testid="transaction-type"]',
  transactionTypeListing: 'option:has-text("Listing"), [data-value="listing"]',
  propertyAddressInput: 'input[name="address"], [data-testid="property-address"], input[placeholder*="address"]',
  createTransactionSubmit: 'button:has-text("Create"), button:has-text("Save"), [data-testid="create-submit"]',

  // Adding forms
  addFormButton: 'button:has-text("Add Form"), button:has-text("Add Document"), [data-testid="add-form"]',
  formSearchInput: 'input[placeholder*="search"], input[name="formSearch"], [data-testid="form-search"]',
  form271Option: '[data-form="271"], tr:has-text("271"), li:has-text("Listing Agreement")',
  form290Option: '[data-form="290"], tr:has-text("290"), li:has-text("MLS Data")',
  addSelectedFormButton: 'button:has-text("Add Selected"), button:has-text("Add"), [data-testid="add-selected"]',

  // Form filling — Form 271 (Listing Agreement)
  form271: {
    sellerName: 'input[name="sellerName"], [data-field="seller-name"]',
    propertyAddress: 'input[name="propertyAddress"], [data-field="property-address"]',
    legalDescription: 'input[name="legalDescription"], [data-field="legal-description"]',
    listPrice: 'input[name="listPrice"], [data-field="list-price"]',
    commissionRate: 'input[name="commission"], [data-field="commission"]',
    listingStartDate: 'input[name="startDate"], [data-field="start-date"]',
    listingEndDate: 'input[name="endDate"], [data-field="end-date"]',
  },

  // Form filling — Form 290 (MLS Data Info)
  form290: {
    mlsNumber: 'input[name="mlsNumber"], [data-field="mls-number"]',
    propertyType: 'select[name="propertyType"], [data-field="property-type"]',
    style: 'input[name="style"], [data-field="style"]',
    address: 'input[name="address"], [data-field="address"]',
    city: 'input[name="city"], [data-field="city"]',
    postalCode: 'input[name="postalCode"], [data-field="postal-code"]',
    listPrice: 'input[name="listPrice"], [data-field="list-price"]',
    bedrooms: 'input[name="bedrooms"], [data-field="bedrooms"]',
    bathrooms: 'input[name="bathrooms"], [data-field="bathrooms"]',
    squareFootage: 'input[name="squareFootage"], [data-field="square-footage"]',
    lotFrontage: 'input[name="lotFrontage"], [data-field="lot-frontage"]',
    lotDepth: 'input[name="lotDepth"], [data-field="lot-depth"]',
    yearBuilt: 'input[name="yearBuilt"], [data-field="year-built"]',
    garage: 'input[name="garage"], [data-field="garage"]',
    parking: 'input[name="parking"], [data-field="parking"]',
    basement: 'input[name="basement"], [data-field="basement"]',
    heating: 'input[name="heating"], [data-field="heating"]',
    cooling: 'input[name="cooling"], [data-field="cooling"]',
    taxes: 'input[name="taxes"], [data-field="taxes"]',
    taxYear: 'input[name="taxYear"], [data-field="tax-year"]',
    legalDescription: 'input[name="legalDescription"], [data-field="legal-description"]',
    pin: 'input[name="pin"], [data-field="pin"]',
    listingDescription: 'textarea[name="description"], [data-field="description"]',
  },
};
