// Geowarehouse DOM selectors discovered from live collaboration.geowarehouse.ca UI.
//
// The detail panel uses consistent HTML IDs prefixed by section:
//   sum-  = Summary panel (bottom of map, always visible after selecting a property)
//   reg-  = Property Details tab (registry / ownership data)
//   ss-   = Site & Structure tab
//   vs-   = Valuation & Sales tab
//   ps-   = Plans, Surveys & Easements tab
//
// The omnibar (top search bar) uses the ob- prefix for its elements.

export const geowarehouseSelectors = {
  // PropTx / app launcher entry
  launcherLink: 'a[href*="/geowarehouse"], [role="link"][href*="/geowarehouse"]',

  // Omnibar search bar (top of collaboration.geowarehouse.ca/ui/home)
  searchInput: '#ob-ff-search-text, input[placeholder*="Address"], input[placeholder*="Search text"]',
  searchButton: '#ob-btn-search, button:has-text("Search"):not(:has-text("Comparables"))',

  // Omnibar search results (dropdown under the search bar)
  resultsList: '#ob-list-container, [id^="ob-list"]',
  resultItem: '[id^="ob-list-item"], [id^="ob-list"] a, [id^="ob-list"] [role="option"]',

  // Summary panel (bottom of map — always visible after property selection)
  summaryAddress: '#sum-h1-address',
  summaryOwnerNames: '#sum-owner-names',
  summaryLastSaleValue: '#sum-lastsale-value',
  summaryLastSaleDate: '#sum-lastsale-date',
  summaryLotArea: '#sum-lotsize-area',
  summaryLotPerimeter: '#sum-lotsize-perimeter',
  summaryLegalDescription: '#sum-legal-desc',

  // Property Details tab — Registry section (reg- prefix)
  regAddress: '#reg-gw-address',
  regLro: '#reg-lro',
  regOwnerNames: '#reg-on',
  regOwnerNamesAlt: '#registry-owner-names',
  regOwnershipType: '#reg-ot',
  regPropertyType: '#reg-pt',
  regRegistrationType: '#reg-rt',
  regPin: '#reg-pin',
  regLegalDescription: '#reg-ls',
  regLandRegistryStatus: '#reg-lrs',

  // Valuation & Sales tab (vs- prefix)
  // Note: assessed value IDs are not reliably present — the vs- section
  // primarily contains the Sales History table.  Assessed value may require
  // a premium Parcel Register report.
  vsSalesHistoryTable: '#vs-tbl-sh',
  vsSalesHistoryContainer: '#vs-tbl-sh-container',

  // Site & Structure tab (ss- prefix)
  ssSiteInfo: '#ss-site',
  ssStructInfo: '#ss-struct',

  // Login detection
  postLoginIndicator: '#ob-btn-search, #sum-h1-address',
};
