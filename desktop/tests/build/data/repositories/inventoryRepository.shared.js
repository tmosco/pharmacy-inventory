"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryRepositoryError = void 0;
exports.mapInventoryError = mapInventoryError;
exports.withDatabase = withDatabase;
exports.requiredText = requiredText;
exports.nullableText = nullableText;
exports.nonnegativeInteger = nonnegativeInteger;
exports.ensureOneRow = ensureOneRow;
class InventoryRepositoryError extends Error {
    code;
    field;
    cause;
    constructor(code, message, field, cause) {
        super(message); // Compatible with TypeScript configurations without ErrorOptions.
        this.code = code;
        this.field = field;
        this.name = "InventoryRepositoryError";
        this.cause = cause;
    }
}
exports.InventoryRepositoryError = InventoryRepositoryError;
function mapInventoryError(error) {
    if (error instanceof InventoryRepositoryError)
        return error;
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
function withDatabase(getConnection) {
    return async function run(operation) {
        try {
            return await operation(await getConnection());
        }
        catch (error) {
            throw mapInventoryError(error);
        }
    };
}
function requiredText(value, field, max = 120) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > max)
        throw new InventoryRepositoryError("INVALID_INPUT", `Enter ${field} (1–${max} characters).`, field);
    return value.trim();
}
function nullableText(value, field, max = 300) {
    if (value === null || value === undefined || value === "")
        return null;
    if (typeof value !== "string" || value.trim().length > max)
        throw new InventoryRepositoryError("INVALID_INPUT", `Enter no more than ${max} characters for ${field}.`, field);
    return value.trim() || null;
}
function nonnegativeInteger(value, field) {
    if (!Number.isSafeInteger(value) || value < 0)
        throw new InventoryRepositoryError("INVALID_INPUT", `${field} must be a non-negative whole number.`, field);
    return value;
}
function ensureOneRow(rowsAffected, label) {
    if (rowsAffected !== 1)
        throw new InventoryRepositoryError("NOT_FOUND", `${label} was not found. Refresh the list.`);
}
