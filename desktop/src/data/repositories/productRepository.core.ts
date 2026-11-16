/** Day 4 repository core: no React or Tauri import required. */
export type ProductStatus = "ACTIVE" | "INACTIVE" | "DISCONTINUED";

/** Values accepted by the existing seven-field Product Form. */
export interface ProductInput {
  sku: string;
  genericName: string;
  brandName: string;
  strength: string;
  dosageForm: string;
  baseUnit: string;
  reorderLevel: number;
}

/** Product as displayed by the application. */
export interface ProductDto extends ProductInput {
  readonly id: string;
  status: ProductStatus;
}

/** How the products table represents a record in SQLite. */
export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  brand_name: string | null;
  strength: string | null;
  dosage_form: string | null;
  base_unit: string;
  reorder_level: number;
  status: ProductStatus;
}

export interface BarcodeMatch {
  product: ProductDto;
  unitId: string;
  unitName: string;
  quantityInBaseUnits: number;
}

/** Minimal data interface implemented by Tauri's SQL Database. */
export interface SqlClient {
  select<T>(sql: string, values?: unknown[]): Promise<T>;
  execute(sql: string, values?: unknown[]): Promise<{ rowsAffected: number }>;
}

export class RepositoryError extends Error {
  public readonly cause?: unknown;

  constructor(
    public readonly code:
      | "INVALID_INPUT"
      | "DUPLICATE_SKU"
      | "DUPLICATE_BARCODE"
      | "NOT_FOUND"
      | "DATABASE_BUSY"
      | "DATABASE_ERROR",
    message: string,
    public readonly field?: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "RepositoryError";
    this.cause = cause;
  }
}

export function mapProductRow(row: ProductRow): ProductDto {
  return {
    id: row.id,
    sku: row.sku,
    genericName: row.name, // SQL uses name; today's React form uses genericName.
    brandName: row.brand_name ?? "",
    strength: row.strength ?? "",
    dosageForm: row.dosage_form ?? "",
    baseUnit: row.base_unit,
    reorderLevel: row.reorder_level,
    status: row.status,
  };
}

export function normalizeProductInput(input: ProductInput): ProductInput {
  const required = ["sku", "genericName", "baseUnit"] as const;
  for (const key of required) {
    if (typeof input[key] !== "string" || !input[key].trim()) {
      throw new RepositoryError("INVALID_INPUT", `Enter a value for ${key}.`, key);
    }
  }
  if (
    !Number.isSafeInteger(input.reorderLevel) ||
    input.reorderLevel < 0
  ) {
    throw new RepositoryError(
      "INVALID_INPUT",
      "Reorder level must be a non-negative whole number.",
      "reorderLevel",
    );
  }
  for (const key of ["brandName", "strength", "dosageForm"] as const) {
    if (typeof input[key] !== "string") {
      throw new RepositoryError("INVALID_INPUT", `Invalid ${key}.`, key);
    }
  }
  return {
    sku: input.sku.trim(),
    genericName: input.genericName.trim(),
    brandName: input.brandName.trim(),
    strength: input.strength.trim(),
    dosageForm: input.dosageForm.trim(),
    baseUnit: input.baseUnit.trim(),
    reorderLevel: input.reorderLevel,
  };
}

/** Translate expected native SQLite errors into safe messages. */
export function toRepositoryError(error: unknown): RepositoryError {
  if (error instanceof RepositoryError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/UNIQUE constraint failed:\s*products\.sku/i.test(message)) {
    return new RepositoryError("DUPLICATE_SKU", "This SKU already exists.", "sku", error);
  }
  if (/UNIQUE constraint failed:\s*product_units\.barcode/i.test(message)) {
    return new RepositoryError("DUPLICATE_BARCODE", "This barcode is already assigned.", "barcode", error);
  }
  if (/database is (locked|busy)|SQLITE_BUSY|SQLITE_LOCKED/i.test(message)) {
    return new RepositoryError("DATABASE_BUSY", "The database is busy. Please try again.", undefined, error);
  }
  return new RepositoryError("DATABASE_ERROR", "The database operation failed.", undefined, error);
}

// Developer-controlled SQL fragment; NEVER put user text into these names.
const columns = `p.id, p.sku, p.name, p.brand_name, p.strength,
  p.dosage_form, p.base_unit, p.reorder_level, p.status`;

/** The connection is injected so tests can provide a fake or test database. */
export function makeProductRepository(
  getConnection: () => Promise<SqlClient>,
  createId: () => string = () => crypto.randomUUID(),
) {
  async function run<T>(operation: (db: SqlClient) => Promise<T>): Promise<T> {
    try {
      return await operation(await getConnection());
    } catch (error) {
      throw toRepositoryError(error);
    }
  }

  return {
    list(): Promise<ProductDto[]> {
      return run(async (db) => {
        const rows = await db.select<ProductRow[]>(
          `SELECT ${columns} FROM products p ORDER BY p.name, p.id`,
        );
        return rows.map(mapProductRow);
      });
    },

    findById(id: string): Promise<ProductDto | null> {
      return run(async (db) => {
        const rows = await db.select<ProductRow[]>(
          `SELECT ${columns} FROM products p WHERE p.id = $1`,
          [id],
        );
        return rows[0] ? mapProductRow(rows[0]) : null;
      });
    },

    findByBarcode(barcode: string): Promise<BarcodeMatch | null> {
      return run(async (db) => {
        const clean = barcode.trim();
        if (!clean) return null;
        const rows = await db.select<(ProductRow & {
          unit_id: string;
          unit_name: string;
          quantity_in_base_units: number;
        })[]>(
          `SELECT ${columns}, u.id AS unit_id,
             u.name AS unit_name,
             u.quantity_in_base_units
           FROM product_units u
           JOIN products p ON p.id = u.product_id
           WHERE u.barcode = $1
           LIMIT 1`,
          [clean],
        );
        const row = rows[0];
        return row ? {
          product: mapProductRow(row),
          unitId: row.unit_id,
          unitName: row.unit_name,
          quantityInBaseUnits: row.quantity_in_base_units,
        } : null;
      });
    },

    create(input: ProductInput): Promise<ProductDto> {
      return run(async (db) => {
        const p = normalizeProductInput(input);
        const id = createId();
        await db.execute(
          `INSERT INTO products
           (id, sku, name, brand_name, strength, dosage_form,
             base_unit, reorder_level, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE')`,
          [id, p.sku, p.genericName, p.brandName || null,
           p.strength || null, p.dosageForm || null,
           p.baseUnit, p.reorderLevel],
        );
        return { ...p, id, status: "ACTIVE" };
      });
    },

    update(id: string, input: ProductInput): Promise<ProductInput> {
      return run(async (db) => {
        const p = normalizeProductInput(input);
        const result = await db.execute(
          `UPDATE products SET sku=$1, name=$2, brand_name=$3,
             strength=$4, dosage_form=$5, base_unit=$6, reorder_level=$7
           WHERE id=$8`,
          [p.sku, p.genericName, p.brandName || null,
           p.strength || null, p.dosageForm || null,
           p.baseUnit, p.reorderLevel, id],
        );
        if (result.rowsAffected !== 1) {
          throw new RepositoryError("NOT_FOUND", "This product no longer exists. Refresh the list.");
        }
        return p;
      });
    },

    deactivate(id: string): Promise<void> {
      return run(async (db) => {
        const result = await db.execute(
          "UPDATE products SET status='INACTIVE' WHERE id=$1",
          [id],
        );
        if (result.rowsAffected !== 1) {
          throw new RepositoryError("NOT_FOUND", "This product no longer exists. Refresh the list.");
        }
      });
    },
  };
}
