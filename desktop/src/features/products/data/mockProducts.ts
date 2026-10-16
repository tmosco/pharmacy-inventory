import type { ProductRecord } from "../product.types";

// Fictional sample records; no database is involved.
export const mockProducts: ProductRecord[] = [
  { id:"p-101",sku:"PARA-500",genericName:"Paracetamol 500mg",brandName:"",strength:"500mg",dosageForm:"Tablet",baseUnit:"TABLET",reorderLevel:20,status:"ACTIVE" },
  { id:"p-102",sku:"IBU-200",genericName:"Ibuprofen 200mg",brandName:"CarePlus",strength:"200mg",dosageForm:"Tablet",baseUnit:"TABLET",reorderLevel:15,status:"ACTIVE" },
  { id:"p-103",sku:"ORS-001",genericName:"Oral Rehydration Salts",brandName:"HydraDemo",strength:"",dosageForm:"Sachet",baseUnit:"PIECE",reorderLevel:30,status:"ACTIVE" },
  { id:"p-104",sku:"VIT-C-100",genericName:"Vitamin C 100mg",brandName:"C-Example",strength:"100mg",dosageForm:"Tablet",baseUnit:"TABLET",reorderLevel:24,status:"INACTIVE" },
  { id:"p-105",sku:"COUGH-100",genericName:"Cough Syrup 100ml",brandName:"DemoCare",strength:"",dosageForm:"Liquid",baseUnit:"PIECE",reorderLevel:8,status:"ACTIVE" },
  { id:"p-106",sku:"ANTISEP-250",genericName:"Antiseptic Solution 250ml",brandName:"",strength:"",dosageForm:"Solution",baseUnit:"PIECE",reorderLevel:12,status:"DISCONTINUED" },
  { id:"p-107",sku:"AMOX-250",genericName:"Amoxicillin 250mg",brandName:"",strength:"250mg",dosageForm:"Capsule",baseUnit:"PIECE",reorderLevel:12,status:"ACTIVE" },
  { id:"p-108",sku:"NIT-GLOV-M",genericName:"Nitrile Gloves Medium",brandName:"DemoSupply",strength:"",dosageForm:"",baseUnit:"PIECE",reorderLevel:40,status:"ACTIVE" },
];
