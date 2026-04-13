// SkySlope Forms selectors discovered against the current Forms + PropTx flow.
// Notes:
// - Login is an embedded Okta flow on skyslope.com/forms-login/.
// - File creation happens on /create, not in an inline modal.
// - Form editing uses a PropTx PDF overlay with native inputs/checkboxes.
// - The field ids in the editor are template-specific and often coordinate-derived.

export const skyslopeSelectors = {
  // Login
  postLoginIndicator: '#create-file-btn, #files-dashboard-link, a:has-text("Go to files dashboard")',
  loginEmailInput: 'input[name="identifier"]',
  loginPasswordInput: 'input[name="credentials.passcode"]',
  loginNextButton: 'input[type="submit"][value="Next"]',

  // File creation (forms.skyslope.com/create)
  newTransactionButton: '#create-file-btn',
  createFileHeading: 'h1:has-text("Create Your File")',
  transactionTypeSelect: 'input[name="representationType"]',
  transactionTypeListing: 'input[name="representationType"][value="Seller"]',
  primaryClientFirstNameInput: '#contacts\\[0\\]\\.firstName',
  primaryClientLastNameInput: '#contacts\\[0\\]\\.lastName',
  primaryClientEmailInput: '#contacts\\[0\\]\\.email',
  propertyAddressInput: '#streetAddress',
  propertyUnitInput: '#unitNumber',
  propertyCityInput: '#city',
  propertyProvinceInput: '#state',
  propertyPostalCodeInput: '#postalCode',
  propertyCountyInput: '#county',
  fileNameInput: '#name',
  createTransactionSubmit: '#submit-button',

  // Adding forms
  addFormButton: 'button:has-text("Add Forms")',
  formSearchInput: 'input[role="searchbox"][aria-label="Search Forms"]',
  formLibraryRow: 'li, [role="option"], tr, [role="row"], [data-rbd-draggable-id]',
  formRowAddButton: 'button[aria-label="Add form to list"]',
  form271Title: '271 Seller Designated Representation Agreement Authority to Offer for Sale - PropTx-OREA',
  form290Title: '290 Freehold - Sale MLS Data Information Form - PropTx-OREA',
  form271Option: 'li:has-text("271 Seller Designated Representation Agreement Authority to Offer for Sale - PropTx-OREA")',
  form290Option: 'li:has-text("290 Freehold - Sale MLS Data Information Form - PropTx-OREA")',
  addSelectedFormButton: 'button[aria-label="Add form to list"]',
  formsAddedCount: 'text=/\\d+\\s+Forms Added/i',
  addFormsNextButton: 'button:has-text("Next")',

  // Documents page / editor shell
  form271Card: '[aria-label*="271 Seller Designated Representation Agreement Authority to Offer for Sale"]',
  form290Card: '[aria-label*="290 Freehold - Sale MLS Data Information Form"]',
  documentActionsButton: 'button[aria-label="document actions"]',
  pageNumberDropdown: '#pageNumberDDL',
  editorIndicator: '#pageNumberDDL, button:has-text("Save & Exit")',
  saveAndExitButton: 'button:has-text("Save & Exit")',
  prepareSignatureButton: 'button:has-text("Prepare Signature")',
  descriptionField: 'textarea[name="description"], [data-field="description"]',

  // Form filling - Form 271 (Listing Agreement)
  // Form 271 mixes file-level auto-population with a few editable text inputs.
  // The live editor currently auto-fills seller/address fields from file creation;
  // list price remains editable as a text input in the PropTx overlay.
  form271: {
    sellerName: 'input[name="sellerName"], [data-field="seller-name"]',
    propertyAddress: 'input[name="propertyAddress"], [data-field="property-address"]',
    legalDescription: 'input[name="legalDescription"], [data-field="legal-description"]',
    listPrice: 'input[id*="*Purchase Price"], input[name="listPrice"], [data-field="list-price"]',
    commissionRate: 'input[name="commission"], [data-field="commission"]',
    listingStartDate: 'input[name="startDate"], [data-field="start-date"]',
    listingEndDate: 'input[name="endDate"], [data-field="end-date"]',
  },

  // ---------------------------------------------------------------------------
  // Form 290 (MLS Data Info) — PropTx editor
  //
  // The PropTx editor renders the form as a scrollable multi-page PDF overlay
  // with native <input> elements. Field IDs follow the pattern:
  //   {templateId}-{fieldName}-{xCoord}-{yCoord}-{pageIndex}
  //
  // Text fields use `input[id*="fieldName"]` selectors.
  // Checkbox fields use `input[id*="optionLabel"]` selectors.
  // Coordinate suffixes are included when needed to disambiguate.
  // ---------------------------------------------------------------------------

  // Form 290 — text field selectors (keyed by canonical field name)
  form290Text: {
    mlsNumber: 'input[id*="*MLS Number"]',
    assessorRoll: 'input[id*="*Assessor\'s Parcel Number"]',
    pin: 'input[id*="Text1111_011"]',
    additionalPin: 'input[id*="Text3_0-414"]',
    area: 'input[id*="Text4_0-44"]',
    municipality: 'input[id*="Text5_0-44"]',
    community: 'input[id*="Text6_0-44"]',
    streetAbbrev: 'input[id*="Text9_0-44"]',
    lotFrontage: 'input[id*="Text12_0"]',
    lotDepth: 'input[id*="Text13_0"]',
    listPrice: 'input[id*="*List Price"]',
    taxes: 'input[id*="Text18_0"]',
    taxYear: 'input[id*="Text19_0"]',
    assessmentValue: 'input[id*="Text20_0"]',
    assessmentYear: 'input[id*="Text21_0"]',
    // Page 2 (DOM 1) — possession days, seller info
    possessionDays: 'input[id*="Text26_0"]',
    // Page 3 (DOM 2) — parking, year built
    garageParkingSpaces: 'input[id*="Text39_0"]',
    drivewayParkingSpaces: 'input[id*="Text65_0"]',
    totalParkingSpaces: 'input[id*="Text64_0"]',
    yearBuilt: 'input[id*="*Year Built"]',
  },

  // Form 290 — checkbox option mappings.
  // Each key is a canonical field name. The value is a record mapping
  // spreadsheet/data values (lowercase) to the checkbox ID substring selector.
  // Step 07 lowercases the incoming data value and looks it up here.
  form290Checkboxes: {
    lotSizeCode: {
      feet: 'input[id*="Feet_0"]',
      acres: 'input[id*="Acres_0-496"]',
      metres: 'input[id*="Acres_0-496"]', // fallback — no dedicated Metres checkbox on some templates
    } as Record<string, string>,
    lotShape: {
      rectangular: 'input[id*="Rectangular_0"]',
      irregular: 'input[id*="Irregular_0"]',
      pie: 'input[id*="Pie_0"]',
      square: 'input[id*="Square_0"]',
      'reverse pie': 'input[id*="Reverse Pie_0"]',
      other: 'input[id*="Other_0-311"]',
    } as Record<string, string>,
    lotSizeSource: {
      geowarehouse: 'input[id*="GeoWarehouse_0"]',
      mpac: 'input[id*="MPAC_0"]',
      survey: 'input[id*="Survey_0"]',
      other: 'input[id*="Other_2_0"]',
    } as Record<string, string>,
    winterized: {
      fully: 'input[id*="Fully_0"]',
      partial: 'input[id*="Partial_0-472"]',
      no: 'input[id*="No_0-518"]',
    } as Record<string, string>,
    hst: {
      'in addition to': 'input[id*="In Addition To_0"]',
      'included in': 'input[id*="Included In_0"]',
      'not subject to hst': 'input[id*="Not Subject to HST"]',
      'not subject': 'input[id*="Not Subject to HST"]',
    } as Record<string, string>,
    developmentCharges: {
      credit: 'input[id*="Credit_0-419"]',
      no: 'input[id*="No_3_0"]',
      partial: 'input[id*="Partial_2_0"]',
      unknown: 'input[id*="Unknown_0-419"]',
      yes: 'input[id*="Yes_2_0"]',
    } as Record<string, string>,
    possession: {
      immediate: 'input[id*="Immediate_0"]',
      flexible: 'input[id*="Flexible_0"]',
      '1-29 days': 'input[id*="129 days_0"]',
      '30-59 days': 'input[id*="3059 days_0"]',
      '60-89 days': 'input[id*="6089 days_0"]',
      '90+ days': 'input[id*="90 days_0"]',
      other: 'input[id*="Other_3_0"]',
    } as Record<string, string>,
    propertyType: {
      'att/row/townhouse': 'input[id*="AttRowTownhouse_0"]',
      townhouse: 'input[id*="AttRowTownhouse_0"]',
      duplex: 'input[id*="Duplex_0"]',
      link: 'input[id*="Link_0-217"]',
      multiplex: 'input[id*="Multiplex_0"]',
      'semi-detached': 'input[id*="SemiDetached_0"]',
      semi: 'input[id*="SemiDetached_0"]',
      cottage: 'input[id*="Cottage_0"]',
      farm: 'input[id*="Farm_0-153"]',
      'mobile/trailer': 'input[id*="MobileTrailer_0"]',
      // "Detached" uses a garbled ID — match by position (page 1, y~284)
      detached: 'input[id*="enene"], input[id*="Detached_0"], input[id*="Detached_1"]',
      fourplex: 'input[id*="Fourplex_0"]',
      'modular home': 'input[id*="Modular Home_0"]',
      'rural residential': 'input[id*="Rural Residential_0"]',
      triplex: 'input[id*="Triplex_0"]',
      other: 'input[id*="Other_4_0"]',
    } as Record<string, string>,
    style: {
      '1 1/2 storey': 'input[id*="1 12 Storey_0"]',
      '2 storey': 'input[id*="2 Storey_0-118"]',
      '2 1/2 storey': 'input[id*="2 12 Storey_0"]',
      '3 storey': 'input[id*="3 Storey_0"]',
      'backsplit 3': 'input[id*="Backsplit 3_0"]',
      'backsplit 4': 'input[id*="Backsplit 4_0"]',
      'backsplit 5': 'input[id*="Backsplit 5_0"]',
      bungalow: 'input[id*="Bungalow_0-245"]',
      'bungalow-raised': 'input[id*="BungalowRaised_0"]',
      bungaloft: 'input[id*="Bungaloft_0"]',
      chalet: 'input[id*="Chalet_0"]',
      contemporary: 'input[id*="Contemporary_0"]',
      'garden house': 'input[id*="Garden House_0"]',
      log: 'input[id*="Log_0-217"]',
      sidesplit: 'input[id*="Sidesplit_0-397"]',
      'sidesplit 3': 'input[id*="Sidesplit 3_0"]',
      'sidesplit 4': 'input[id*="Sidesplit 4_0"]',
      'sidesplit 5': 'input[id*="Sidesplit 5_0"]',
      other: 'input[id*="Other_5_0"]',
    } as Record<string, string>,
    exterior: {
      'aluminium siding': 'input[id*="Aluminium Siding_0"]',
      aluminum: 'input[id*="Aluminium Siding_0"]',
      brick: 'input[id*="Brick_0-132"]',
      'brick front': 'input[id*="Brick Front_0"]',
      'brick veneer': 'input[id*="Brick Veneer_0"]',
      cedar: 'input[id*="Cedar_0"]',
      concrete: 'input[id*="Concrete_0-153"]',
      hardboard: 'input[id*="Hardboard_0"]',
      log: 'input[id*="Log_2_0"]',
      metal: 'input[id*="MetalSteel Siding_0"]',
      shingle: 'input[id*="Shingle_0"]',
      stone: 'input[id*="Stone_0-375"]',
      stucco: 'input[id*="Stucco Plaster_0"]',
      'vinyl siding': 'input[id*="Vinyl Siding_0"]',
      vinyl: 'input[id*="Vinyl Siding_0"]',
      wood: 'input[id*="Wood_0-397"]',
      other: 'input[id*="Other_6_0"]',
    } as Record<string, string>,
    garageType: {
      attached: 'input[id*="Attached_0-154"]',
      'built-in': 'input[id*="BuiltIn_0"]',
      carport: 'input[id*="Carport_0"]',
      detached: 'input[id*="Detached_2_0"]',
      none: 'input[id*="None_0-372"]',
      other: 'input[id*="Other_9_0"]',
    } as Record<string, string>,
    driveway: {
      available: 'input[id*="Available_0"]',
      'front yard': 'input[id*="Front Yard Parking_0"]',
      none: 'input[id*="None_2_0"]',
      'private double': 'input[id*="Private Double_0"]',
      'private triple': 'input[id*="Private Triple_0"]',
      private: 'input[id*="Private_0-306"]',
      mutual: 'input[id*="Mutual_0"]',
      lane: 'input[id*="Lane_0"]',
      other: 'input[id*="Other_10_0"]',
    } as Record<string, string>,
    water: {
      municipal: 'input[id*="Municipal_0-88"]',
      well: 'input[id*="Well_0"]',
      both: 'input[id*="Both_0"]',
      none: 'input[id*="None_3_0"]',
      other: 'input[id*="Other_11_0"]',
    } as Record<string, string>,
    sewers: {
      sewer: 'input[id*="Sewer_0"]',
      septic: 'input[id*="Septic_0"]',
      'holding tank': 'input[id*="Holding Tank_0"]',
      none: 'input[id*="None_5_0"]',
      other: 'input[id*="Other_13_0"]',
    } as Record<string, string>,
    approxSquareFootage: {
      'under 700': 'input[id*="700_0-49"]',
      '700-1100': 'input[id*="7001100_0"]',
      '1100-1500': 'input[id*="11001500_0"]',
      '1500-2000': 'input[id*="15002000_0"]',
      '2000-2500': 'input[id*="20002500_0"]',
      '2500-3000': 'input[id*="25003000_0"]',
      '3000-3500': 'input[id*="30003500_0"]',
      '3500-5000': 'input[id*="35005000_0"]',
      '5000+': 'input[id*="5000_0"]',
    } as Record<string, string>,
  },

  // Legacy form290 object kept for backwards compatibility with any code
  // that may reference it. Step 07 now uses form290Text + form290Checkboxes.
  form290: {} as Record<string, string>,
};
