import {
  ensureOneRow, InventoryRepositoryError, nullableText, requiredText,
  withDatabase, type GetConnection, type SqlClient,
} from "./inventoryRepository.shared";

export interface NewProductUnit {
  productId: string;
  name: string;
  quantityInBaseUnits: number;
  barcode: string;
  packDescription: string;
  canPurchase?: boolean;
  canSell?: boolean;
}
export type ProductUnitChanges = Omit<NewProductUnit, "productId">;

export interface ProductUnitRecord {
  readonly id: string;
  productId: string;
  name: string;
  quantityInBaseUnits: number;
  barcode: string;
  packDescription: string;
  isActive: boolean;
  canPurchase: boolean;
  canSell: boolean;
}

export type ProductUnitOperation = "PURCHASE" | "SALE";

interface ProductUnitRow {
  id: string; product_id: string; name: string; quantity_in_base_units: number;
  barcode: string | null; pack_description: string | null;
  is_active: number; can_purchase: number; can_sell: number;
}
interface ProductConfigRow { id: string; }
const COLUMNS = "id,product_id,name,quantity_in_base_units,barcode,pack_description,is_active,can_purchase,can_sell";

export function mapProductUnit(row: ProductUnitRow): ProductUnitRecord {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    quantityInBaseUnits: row.quantity_in_base_units,
    barcode: row.barcode ?? "",
    packDescription: row.pack_description ?? "",
    isActive: row.is_active === 1,
    canPurchase: row.can_purchase === 1,
    canSell: row.can_sell === 1,
  };
}

async function getRaw(db: SqlClient, productId: string, unitId: string): Promise<ProductUnitRow | null> {
  const rows = await db.select<ProductUnitRow[]>(
    `SELECT ${COLUMNS} FROM product_units WHERE product_id=$1 AND id=$2`, [productId, unitId],
  );
  return rows[0] ?? null;
}

async function normalize(db: SqlClient, input: NewProductUnit): Promise<NewProductUnit> {
  const productId = requiredText(input.productId, "productId");
  const products = await db.select<ProductConfigRow[]>("SELECT id FROM products WHERE id=$1", [productId]);
  if (!products[0]) throw new InventoryRepositoryError("NOT_FOUND", "Product does not exist.", "productId");
  if (!Number.isSafeInteger(input.quantityInBaseUnits) || input.quantityInBaseUnits <= 0) {
    throw new InventoryRepositoryError(
      "INVALID_INPUT", "Conversion must be a positive whole number of base units.", "quantityInBaseUnits",
    );
  }
  return {
    productId,
    name: requiredText(input.name, "name", 120),
    quantityInBaseUnits: input.quantityInBaseUnits,
    barcode: nullableText(input.barcode, "barcode", 100) ?? "",
    packDescription: nullableText(input.packDescription, "packDescription", 500) ?? "",
    canPurchase: input.canPurchase ?? true,
    canSell: input.canSell ?? true,
  };
}

export function assertProductUnitAllowed(unit: ProductUnitRecord, operation: ProductUnitOperation): void {
  if (!unit.isActive) {
    throw new InventoryRepositoryError("INACTIVE_UNIT", `Package “${unit.name}” is inactive.`, "isActive");
  }
  if (operation === "PURCHASE" && !unit.canPurchase) {
    throw new InventoryRepositoryError("UNIT_OPERATION_NOT_ALLOWED", `Package “${unit.name}” cannot be used for purchases.`, "canPurchase");
  }
  if (operation === "SALE" && !unit.canSell) {
    throw new InventoryRepositoryError("UNIT_OPERATION_NOT_ALLOWED", `Package “${unit.name}” cannot be used for sales.`, "canSell");
  }
}

export function makeProductUnitRepository(
  getConnection: GetConnection,
  createId: () => string = () => crypto.randomUUID(),
) {
  const run = withDatabase(getConnection);
  return {
    listByProduct(productId: string): Promise<ProductUnitRecord[]> {
      return run(async (db) => (await db.select<ProductUnitRow[]>(
        `SELECT ${COLUMNS} FROM product_units WHERE product_id=$1 ORDER BY name,id`,
        [requiredText(productId, "productId")],
      )).map(mapProductUnit));
    },
    /** Backwards-compatible name used by the earlier Day 2 UI. */
    listForProduct(productId: string): Promise<ProductUnitRecord[]> {
      return this.listByProduct(productId);
    },
    findById(id: string): Promise<ProductUnitRecord | null> {
      return run(async (db) => {
        const rows = await db.select<ProductUnitRow[]>(
          `SELECT ${COLUMNS} FROM product_units WHERE id=$1`, [requiredText(id, "id")],
        );
        return rows[0] ? mapProductUnit(rows[0]) : null;
      });
    },
    /** Returns inactive matches too, so barcode identification explains status. */
    findByBarcode(barcode: string): Promise<ProductUnitRecord | null> {
      return run(async (db) => {
        const normalized = requiredText(barcode, "barcode", 100);
        const rows = await db.select<ProductUnitRow[]>(
          `SELECT ${COLUMNS} FROM product_units WHERE barcode=$1`, [normalized],
        );
        return rows[0] ? mapProductUnit(rows[0]) : null;
      });
    },
    create(input: NewProductUnit): Promise<string> {
      return run(async (db) => {
        const value = await normalize(db, input);
        const id = createId();
        await db.execute(
          `INSERT INTO product_units
           (id,product_id,name,quantity_in_base_units,barcode,pack_description,can_purchase,can_sell)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [id, value.productId, value.name, value.quantityInBaseUnits,
            value.barcode || null, value.packDescription || null,
            value.canPurchase ? 1 : 0, value.canSell ? 1 : 0],
        );
        return id;
      });
    },
    update(productId: string, unitId: string, changes: ProductUnitChanges): Promise<ProductUnitRecord> {
      return run(async (db) => {
        const productKey = requiredText(productId, "productId");
        const unitKey = requiredText(unitId, "unitId");
        const existing = await getRaw(db, productKey, unitKey);
        if (!existing) throw new InventoryRepositoryError("NOT_FOUND", "Package was not found for this product.");
        const value = await normalize(db, { ...changes, productId: productKey });
        const result = await db.execute(
          `UPDATE product_units SET name=$1,quantity_in_base_units=$2,barcode=$3,
           pack_description=$4,can_purchase=$5,can_sell=$6 WHERE product_id=$7 AND id=$8`,
          [value.name, value.quantityInBaseUnits, value.barcode || null,
            value.packDescription || null, value.canPurchase ? 1 : 0, value.canSell ? 1 : 0,
            productKey, unitKey],
        );
        ensureOneRow(result.rowsAffected, "Package");
        return mapProductUnit({ ...existing, name: value.name,
          quantity_in_base_units: value.quantityInBaseUnits,
          barcode: value.barcode || null, pack_description: value.packDescription || null,
          can_purchase: value.canPurchase ? 1 : 0, can_sell: value.canSell ? 1 : 0 });
      });
    },
    deactivate(productId: string, unitId: string): Promise<ProductUnitRecord> {
      return run(async (db) => {
        const productKey = requiredText(productId, "productId");
        const unitKey = requiredText(unitId, "unitId");
        const result = await db.execute(
          "UPDATE product_units SET is_active=0 WHERE product_id=$1 AND id=$2 AND is_active=1",
          [productKey, unitKey],
        );
        ensureOneRow(result.rowsAffected, "Active package");
        const rows = await db.select<ProductUnitRow[]>(
          `SELECT ${COLUMNS} FROM product_units WHERE product_id=$1 AND id=$2`, [productKey, unitKey],
        );
        if (!rows[0]) throw new InventoryRepositoryError("NOT_FOUND", "Package was not found for this product.");
        return mapProductUnit(rows[0]);
      });
    },
  };
}
