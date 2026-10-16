import type { ProductFormValues } from "./product.schema";

export type ProductStatus = "ACTIVE" | "INACTIVE" | "DISCONTINUED";

// A catalog record; purchase-batch cost, expiry and quantity belong elsewhere.
export type ProductRecord = ProductFormValues & {
  readonly id: string;
  status: ProductStatus;
};
