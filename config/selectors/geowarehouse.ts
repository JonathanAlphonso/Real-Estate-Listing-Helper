// Geowarehouse DOM selectors — placeholders.
// Use `npm run start -- --debug` and Playwright Inspector to discover actual selectors.

export const geowarehouseSelectors = {
  // Search
  searchInput: '#search-input, input[placeholder*="address"], input[name="address"]',
  searchButton: 'button:has-text("Search"), input[type="submit"], .search-btn',

  // Results
  resultsList: '.results-list, .search-results, table.results',
  resultItem: '.result-item, .search-result, tr.result',

  // Property detail
  detailContainer: '.property-detail, #propertyDetail, .parcel-detail',
  pin: '[data-field="pin"], .pin-value, td:has-text("PIN") + td',
  legalDescription: '[data-field="legalDesc"], .legal-desc, td:has-text("Legal") + td',
  municipalAddress: '[data-field="address"], .municipal-address',
  municipality: '[data-field="municipality"], td:has-text("Municipality") + td',
  lotDimensions: '[data-field="lotDimensions"], td:has-text("Lot Size") + td, td:has-text("Dimensions") + td',
  lotArea: '[data-field="lotArea"], td:has-text("Lot Area") + td',
  registeredOwners: '[data-field="owners"], .owner-name, td:has-text("Owner") + td',
  assessedValue: '[data-field="assessment"], td:has-text("Assessed") + td, td:has-text("Assessment") + td',
  propertyClass: '[data-field="propertyClass"], td:has-text("Class") + td',
  instrumentNumber: '[data-field="instrument"], td:has-text("Instrument") + td',
  registrationDate: '[data-field="regDate"], td:has-text("Registration") + td',

  // Login detection
  postLoginIndicator: '.dashboard, .user-menu, a:has-text("Logout"), .account-menu',
};
