// Default values for a typical Ontario freehold residential listing.
// These are used as fallbacks when the property CSV doesn't have a value.
// Step 07 reads from property data first, then falls back to these defaults.
//
// Values here should be safe, common defaults — never assume specifics
// about a property that could be wrong (e.g. don't default "Detached").
// Use "Unknown" or leave blank for fields that genuinely vary.

export const listingDefaults: Record<string, string> = {
  // ── Lot ─────────────────────────────────────────────────────────────────
  lotSizeCode: 'Feet',
  lotShape: 'Rectangular',
  lotSizeSource: 'GeoWarehouse',

  // ── Property flags ─────────────────────────────────────────────────────
  winterized: 'No',
  hst: 'Not Subject to HST',
  developmentCharges: 'Unknown',
  waterfront: 'No',             // jtrheherh checkbox
  acreage: 'Not Applicable',    // fnettrej checkbox

  // ── Possession ─────────────────────────────────────────────────────────
  possession: 'Flexible',
  holdoverDays: '90',

  // ── Utilities ──────────────────────────────────────────────────────────
  water: 'Municipal',
  sewers: 'Sewer',
  pool: 'None',

  // ── Designation & status ───────────────────────────────────────────────
  specialDesignation: 'Unknown',
  retirementCommunity: 'No',
  physicallyHandicapped: 'No',
  survey: 'Unknown',

  // ── Foundation ─────────────────────────────────────────────────────────
  foundation: 'Poured Concrete',

  // ── Basement ───────────────────────────────────────────────────────────
  basement: 'Finished',
  basementType: 'Full',

  // ── Heating & Cooling ──────────────────────────────────────────────────
  heatSource: 'Gas',
  heatType: 'Forced Air',
  airConditioning: 'Central Air',

  // ── Fireplace ──────────────────────────────────────────────────────────
  fireplaces: '1',
  fireplaceStove: 'Gas',

  // ── Rooms (typical 3-bedroom detached) ─────────────────────────────────
  totalRooms: '7',
  totalRoomsPlus: '1',
  bedrooms: '3',
  bedroomsPlus: '1',
  kitchens: '1',
  kitchensPlus: '0',

  // ── Washrooms ──────────────────────────────────────────────────────────
  washroomTotal: '2',
  // Individual washroom breakdown: "pieces x count" format
  // e.g. "4pc 1, 3pc 1" means one 4-piece and one 3-piece bathroom

  // ── Family Room ────────────────────────────────────────────────────────
  familyRoom: 'Yes',

  // ── Roof ───────────────────────────────────────────────────────────────
  roof: 'Shingles',

  // ── Sqft source ────────────────────────────────────────────────────────
  sqftSource: 'Owner',

  // ── Internet & Distribution ────────────────────────────────────────────
  distributeToInternet: 'Yes',
  displayAddressOnInternet: 'Yes',
  distributeToDDF: 'Yes',
  sellerPropertyInfoStatement: 'No',

  // ── Showing ────────────────────────────────────────────────────────────
  showingRequirements: 'Go Direct',

  // ── Commission ─────────────────────────────────────────────────────────
  commissionCoopBrokerage: '2.5',

  // ── Occupancy ──────────────────────────────────────────────────────────
  occupancy: 'Owner',

  // ── Standard inclusions/exclusions ─────────────────────────────────────
  inclusions: 'Fridge, Stove, Dishwasher, Washer, Dryer, All Electrical Light Fixtures, All Window Coverings',
  exclusions: '',
  rentalItems: '',
};
