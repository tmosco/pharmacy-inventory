import { getDb } from "../db";
import { RepositoryError, toRepositoryError } from "./productRepository.core";

export interface NewProductUnit {
  productId: string;
  name: string;
  quantityInBaseUnits: number;
  barcode: string;
  packDescription: string;
}

/** Each unit is a separate commit for this lesson, NOT an atomic purchase workflow. */
export const productUnitRepository = {
  async create(input: NewProductUnit): Promise<string> {
    const name = input.name.trim();
    const barcode = input.barcode.trim();
    if (!input.productId || !name ||
      !Number.isFinite(input.quantityInBaseUnits) || input.quantityInBaseUnits <= 0) {
      throw new RepositoryError("INVALID_INPUT", "Enter a packaging name and a positive conversion quantity.");
    }
    const id = crypto.randomUUID();
    try {
      const db = await getDb();
      await db.execute(
        `INSERT INTO product_units
           (id, product_id, name, quantity_in_base_units, barcode, pack_description)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, input.productId, name, input.quantityInBaseUnits,
          barcode || null, input.packDescription.trim() || null],
      );
      return id;
    } catch (error) {
      throw toRepositoryError(error);
    }
  },
};
