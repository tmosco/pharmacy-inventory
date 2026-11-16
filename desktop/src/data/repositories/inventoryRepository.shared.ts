/** Shared types and validation for Week 5 inventory repositories.
 * Uses the same select/execute contract as @tauri-apps/plugin-sql.
 * This module never opens a database; inject a provider for tests.
 */
export interface SqlClient {
  select<T>(sql: string, bindValues?: unknown[]): Promise<T>;
  execute(sql: string, bindValues?: unknown[]): Promise<{ rowsAffected: number }>;
}
export type GetConnection = () => Promise<SqlClient>;

export type InventoryErrorCode =
  | "INVALID_INPUT"
  | "DUPLICATE_BRANCH_CODE"
  | "DUPLICATE_LOCATION_CODE"
  | "DUPLICATE_SHELF_POSITION"
  | "DUPLICATE_UNIT_NAME"
  | "DUPLICATE_BARCODE"
  | "NOT_FOUND"
  | "INVALID_PARENT"
  | "LOCATION_CYCLE"
  | "REFERENCE_IN_USE"
  | "DATABASE_BUSY"
  | "DATABASE_ERROR";

export class InventoryRepositoryError extends Error {
  public readonly cause?: unknown;
  constructor(
    public readonly code: InventoryErrorCode,
    message: string,
    public readonly field?: string,
    cause?: unknown,
  ) {
    super(message); // Compatible with TypeScript configurations without ErrorOptions.
    this.name = "InventoryRepositoryError";
    this.cause = cause;
  }
}

export function mapInventoryError(error: unknown): InventoryRepositoryError {
  if (error instanceof InventoryRepositoryError) return error;
  const details = error instanceof Error ? error.message : String(error);
  if (/UNIQUE constraint failed:\s*branches\.code/i.test(details))
    return new InventoryRepositoryError("DUPLICATE_BRANCH_CODE", "This branch code already exists.", "code", error);
  if (/UNIQUE constraint failed:\s*locations\.branch_id,\s*locations\.code/i.test(details))
    return new InventoryRepositoryError("DUPLICATE_LOCATION_CODE", "This location code already exists in this branch.", "code", error);
  if (/UNIQUE constraint failed:\s*locations\.parent_location_id,\s*locations\.position/i.test(details))
    return new InventoryRepositoryError("DUPLICATE_SHELF_POSITION", "This shelf already has that section position.", "position", error);
  if (/UNIQUE constraint failed:\s*product_units\.product_id,\s*product_units\.name/i.test(details))
    return new InventoryRepositoryError("DUPLICATE_UNIT_NAME", "This packaging unit already exists for the product.", "name", error);
  if (/UNIQUE constraint failed:\s*product_units\.barcode/i.test(details))
    return new InventoryRepositoryError("DUPLICATE_BARCODE", "This barcode is already assigned to another unit.", "barcode", error);
  if (/FOREIGN KEY constraint failed/i.test(details))
    return new InventoryRepositoryError("REFERENCE_IN_USE", "The record references another record, or is still in use.", undefined, error);
  if (/database is (locked|busy)|SQLITE_BUSY|SQLITE_LOCKED/i.test(details))
    return new InventoryRepositoryError("DATABASE_BUSY", "The database is busy. Try again shortly.", undefined, error);
  return new InventoryRepositoryError("DATABASE_ERROR", "Database operation failed. Check the development logs.", undefined, error);
}

export function withDatabase(getConnection: GetConnection) {
  return async function run<T>(operation: (db: SqlClient) => Promise<T>): Promise<T> {
    try { return await operation(await getConnection()); }
    catch (error) { throw mapInventoryError(error); }
  };
}

export function requiredText(value: unknown, field: string, max = 120): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new InventoryRepositoryError("INVALID_INPUT", `Enter ${field} (1–${max} characters).`, field);
  return value.trim();
}

export function nullableText(value: unknown, field: string, max = 300): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max)
    throw new InventoryRepositoryError("INVALID_INPUT", `Enter no more than ${max} characters for ${field}.`, field);
  return value.trim() || null;
}

export function nonnegativeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new InventoryRepositoryError("INVALID_INPUT", `${field} must be a non-negative whole number.`, field);
  return value as number;
}

export function ensureOneRow(rowsAffected: number, label: string): void {
  if (rowsAffected !== 1)
    throw new InventoryRepositoryError("NOT_FOUND", `${label} was not found. Refresh the list.`);
}
