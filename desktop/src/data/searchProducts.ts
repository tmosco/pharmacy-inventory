// Temporary search-only records for Day 2, not a replacement for domain.ts.
// Brand names are fictional demonstration labels, not product endorsements.
export interface SearchProduct {
  readonly id: string;
  genericName: string;
  brandName: string | null;
  sku: string;
}

export const searchProducts: readonly SearchProduct[] = [
  {
    id: "product-001",
    genericName: "Paracetamol 500mg",
    brandName: "ReliefOne",
    sku: "PARA-500-R",
  },
  {
    id: "product-002",
    genericName: "Paracetamol 500mg",
    brandName: null,
    sku: "PARA-500-G",
  },
  {
    id: "product-003",
    genericName: "Ibuprofen 200mg",
    brandName: "DemoCare",
    sku: "IBU-200",
  },
  {
    id: "product-004",
    genericName: "Oral rehydration salts",
    brandName: "HydraDemo",
    sku: "ORS-001",
  },
];
