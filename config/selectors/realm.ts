// Realm DOM selectors discovered against the current PropTx / REALM UI.
// The current flow is split between:
// - the global "Search REALM" dialog
// - the historical table view used for archived address searches

export const realmSelectors = {
  // Post-login / navigation
  postLoginIndicator:
    '.user-greeting__greeting, button.search-properties__search, a[href*="app.realmmlp.ca/auth/amp"], text=My Market Areas, text=Recent Searches',
  openSearchButton: 'button[aria-label="Open search"]',
  memberAccessButton:
    'div:has(p:text-is("Member")) button, div:has(img[alt*="Toronto Regional Real Estate Board"]) button',

  // Global search dialog
  searchInput: 'input[placeholder*="street address"], input[placeholder*="MLS#"], input[placeholder*="Search"]',
  searchButton: 'button:has-text("Search with Realm AI")',

  // Historical table-mode results
  resultsTable: 'table.data-table-new',
  resultRow: 'table.data-table-new tbody tr',
  resultAddress: 'table.data-table-new a.streetAddress',

  // Property detail page
  detailModal: '[role="dialog"]',
  detailContainer: '.listing-full, #section-overview',
  overviewSection: '#section-overview',
  listingInfoSection: '#section-listing-info',
  propertyInfoSection: '#section-property-info',
  mlsNumber: '#section-overview .listing-id',
  salePrice: '#section-overview .price h1, #section-listing-info',
  listPrice: '#section-listing-info',
  saleDate: '#section-listing-info',
  propertyType: '#section-overview .addr h2',
  style: '#section-overview .addr h2',
  bedrooms: '#section-overview .short-details td',
  bathrooms: '#section-overview .short-details td',
  squareFootage: '#section-overview .short-details td, #section-property-info',
  lotFrontage: '#section-property-info',
  lotDepth: '#section-property-info',
  lotSize: '#section-property-info',
  yearBuilt: '#section-property-info',
  garage: '#section-property-info',
  parking: '#section-property-info',
  basement: '#section-property-info',
  heating: '#section-property-info',
  cooling: '#section-property-info',
  taxes: '#section-overview .price h2, #section-listing-info',
  taxYear: '#section-listing-info',

  // Prior sales / history
  salesHistoryTab: 'a[href="#section-property-history"]',
  salesHistoryTable: '#section-property-history table.history-table',
  salesHistoryRow: '#section-property-history tbody tr',

  // Similar / comparable listings are not consistently present in the current UI.
  // Keep these optional selectors as probes rather than required elements.
  comparablesTab: '.similar-container, [data-deferred-url*="/similar"]',
  comparablesTable: '.similar-container table',
  comparableRow: '.similar-container tbody tr',
};
