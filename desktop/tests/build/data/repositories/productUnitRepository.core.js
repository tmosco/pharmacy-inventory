"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapProductUnit = mapProductUnit;
exports.makeProductUnitRepository = makeProductUnitRepository;
const inventoryRepository_shared_1 = require("./inventoryRepository.shared");
const COLUMNS = "id,product_id,name,quantity_in_base_units,barcode,pack_description";
function mapProductUnit(row) {
    return {
        id: row.id, productId: row.product_id, name: row.name,
        quantityInBaseUnits: row.quantity_in_base_units,
        barcode: row.barcode ?? "", packDescription: row.pack_description ?? "",
    };
}
async function getRaw(db, id) {
    const rows = await db.select(`SELECT ${COLUMNS} FROM product_units WHERE id=$1`, [id]);
    return rows[0] ?? null;
}
async function normalize(db, input) {
    const productId = (0, inventoryRepository_shared_1.requiredText)(input.productId, "productId");
    const products = await db.select("SELECT id,quantity_precision FROM products WHERE id=$1", [productId]);
    if (!products[0])
        throw new inventoryRepository_shared_1.InventoryRepositoryError("NOT_FOUND", "Product does not exist.", "productId");
    const quantity = input.quantityInBaseUnits;
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0)
        throw new inventoryRepository_shared_1.InventoryRepositoryError("INVALID_INPUT", "Conversion must be a positive finite quantity.", "quantityInBaseUnits");
    const precision = products[0].quantity_precision;
    if (!Number.isInteger(precision) || precision < 0 || precision > 3)
        throw new inventoryRepository_shared_1.InventoryRepositoryError("INVALID_INPUT", "Product has an invalid quantity precision.");
    // Small epsilon handles binary floating point for decimal conversions.
    const scaled = quantity * 10 ** precision;
    if (!Number.isSafeInteger(Math.round(scaled)) || Math.abs(scaled - Math.round(scaled)) > 1e-8)
        throw new inventoryRepository_shared_1.InventoryRepositoryError("INVALID_INPUT", `This product allows at most ${precision} decimal place(s) in base-unit quantities.`, "quantityInBaseUnits");
    return {
        productId,
        name: (0, inventoryRepository_shared_1.requiredText)(input.name, "name", 120),
        quantityInBaseUnits: quantity,
        barcode: (0, inventoryRepository_shared_1.nullableText)(input.barcode, "barcode", 100) ?? "",
        packDescription: (0, inventoryRepository_shared_1.nullableText)(input.packDescription, "packDescription", 500) ?? "",
    };
}
function makeProductUnitRepository(getConnection, createId = () => crypto.randomUUID()) {
    const run = (0, inventoryRepository_shared_1.withDatabase)(getConnection);
    return {
        listForProduct(productId) {
            return run(async (db) => (await db.select(`SELECT ${COLUMNS} FROM product_units WHERE product_id=$1 ORDER BY name,id`, [(0, inventoryRepository_shared_1.requiredText)(productId, "productId")])).map(mapProductUnit));
        },
        findById(id) {
            return run(async (db) => {
                const row = await getRaw(db, (0, inventoryRepository_shared_1.requiredText)(id, "id"));
                return row ? mapProductUnit(row) : null;
            });
        },
        findByBarcode(barcode) {
            return run(async (db) => {
                const normalized = (0, inventoryRepository_shared_1.requiredText)(barcode, "barcode", 100);
                const rows = await db.select(`SELECT ${COLUMNS} FROM product_units WHERE barcode=$1`, [normalized]);
                return rows[0] ? mapProductUnit(rows[0]) : null;
            });
        },
        /** Returns the new unit ID for compatibility with your existing UI. */
        create(input) {
            return run(async (db) => {
                const value = await normalize(db, input);
                const id = createId();
                await db.execute(`INSERT INTO product_units
           (id,product_id,name,quantity_in_base_units,barcode,pack_description)
           VALUES ($1,$2,$3,$4,$5,$6)`, [id, value.productId, value.name, value.quantityInBaseUnits,
                    value.barcode || null, value.packDescription || null]);
                return id;
            });
        },
        update(id, changes) {
            return run(async (db) => {
                const key = (0, inventoryRepository_shared_1.requiredText)(id, "id");
                const existing = await getRaw(db, key);
                if (!existing)
                    throw new inventoryRepository_shared_1.InventoryRepositoryError("NOT_FOUND", "Packaging unit not found.");
                const value = await normalize(db, { ...changes, productId: existing.product_id });
                const result = await db.execute(`UPDATE product_units SET name=$1,quantity_in_base_units=$2,
           barcode=$3,pack_description=$4 WHERE id=$5`, [value.name, value.quantityInBaseUnits, value.barcode || null,
                    value.packDescription || null, key]);
                (0, inventoryRepository_shared_1.ensureOneRow)(result.rowsAffected, "Packaging unit");
                return { id: key, ...value };
            });
        },
    };
}
