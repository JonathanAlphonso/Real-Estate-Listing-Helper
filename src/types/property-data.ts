export interface ComparableSale {
  address: string;
  salePrice: number;
  saleDate: string;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  lotSize: string;
  propertyType: string;
  daysOnMarket: number;
}

export interface RealmData {
  // Subject property info
  address: string;
  mlsNumber?: string;
  listPrice?: number;
  salePrice?: number;
  saleDate?: string;
  propertyType: string;
  style?: string;
  bedrooms: number;
  bathrooms: number;
  squareFootage?: number;
  lotFrontage?: string;
  lotDepth?: string;
  lotSize?: string;
  yearBuilt?: string;
  garage?: string;
  parking?: string;
  basement?: string;
  heating?: string;
  cooling?: string;
  taxes?: number;
  taxYear?: string;
  // Prior sale data
  priorSalePrice?: number;
  priorSaleDate?: string;
  // Comparables (used if no prior sale found)
  comparables: ComparableSale[];
}

export interface GeowarehouseData {
  pin: string;
  legalDescription: string;
  municipalAddress: string;
  municipality: string;
  lotDimensions: string;
  lotArea?: string;
  registeredOwners: string[];
  assessedValue?: number;
  assessmentYear?: string;
  propertyClass?: string;
  landRegistryOffice?: string;
  instrumentNumber?: string;
  registrationDate?: string;
}

export interface PropertyData {
  // Core identifiers
  address: string;
  unit?: string;
  city: string;
  province: string;
  postalCode: string;

  // Realm data
  realm: RealmData;

  // Geowarehouse data
  geowarehouse: GeowarehouseData;

  // Generated
  listingDescription?: string;
}
