/** Replace the older create-only Day 5 productUnitRepository.ts with this file.
 * Existing `await productUnitRepository.create(input)` still returns an ID.
 */
import { getDb } from "../db";
import { makeProductUnitRepository } from "./productUnitRepository.core";

export const productUnitRepository = makeProductUnitRepository(getDb);
export type { NewProductUnit, ProductUnitRecord, ProductUnitChanges } from "./productUnitRepository.core";
