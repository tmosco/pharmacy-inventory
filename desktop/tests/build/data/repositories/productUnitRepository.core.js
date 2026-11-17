"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapProductUnit = mapProductUnit;
exports.assertProductUnitAllowed = assertProductUnitAllowed;
exports.makeProductUnitRepository = makeProductUnitRepository;
const inventoryRepository_shared_1 = require("./inventoryRepository.shared");
const COLUMNS = "id,product_id,name,quantity_in_base_units,barcode,pack_description,is_active,can_purchase,can_sell";
function mapProductUnit(row) {
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
async function getRaw(db, productId, unitId) {
    const rows = await db.select(`SELECT ${COLUMNS} FROM product_units WHERE product_id=$1 AND id=$2`, [productId, unitId]);
    return rows[0] ?? null;
}
async function normalize(db, input) {
    const productId = (0, inventoryRepository_shared_1.requiredText)(input.productId, "productId");
    const products = await db.select("SELECT id FROM products WHERE id=$1", [productId]);
    if (!products[0])
        throw new inventoryRepository_shared_1.InventoryRepositoryError("NOT_FOUND", "Product does not exist.", "productId");
    if (!Number.isSafeInteger(input.quantityInBaseUnits) || input.quantityInBaseUnits <= 0) {
        throw new inventoryRepository_shared_1.InventoryRepositoryError("INVALID_INPUT", "Conversion must be a positive whole number of base units.", "quantityInBaseUnits");
    }
    return {
        productId,
        name: (0, inventoryRepository_shared_1.requiredText)(input.name, "name", 120),
        quantityInBaseUnits: input.quantityInBaseUnits,
        barcode: (0, inventoryRepository_shared_1.nullableText)(input.barcode, "barcode", 100) ?? "",
        packDescription: (0, inventoryRepository_shared_1.nullableText)(input.packDescription, "packDescription", 500) ?? "",
        canPurchase: input.canPurchase ?? true,
        canSell: input.canSell ?? true,
    };
}
function assertProductUnitAllowed(unit, operation) {
    if (!unit.isActive) {
        throw new inventoryRepository_shared_1.InventoryRepositoryError("INACTIVE_UNIT", `Package “${unit.name}” is inactive.`, "isActive");
    }
    if (operation === "PURCHASE" && !unit.canPurchase) {
        throw new inventoryRepository_shared_1.InventoryRepositoryError("UNIT_OPERATION_NOT_ALLOWED", `Package “${unit.name}” cannot be used for purchases.`, "canPurchase");
    }
    if (operation === "SALE" && !unit.canSell) {
        throw new inventoryRepository_shared_1.InventoryRepositoryError("UNIT_OPERATION_NOT_ALLOWED", `Package “${unit.name}” cannot be used for sales.`, "canSell");
    }
}
function makeProductUnitRepository(getConnection, createId = () => crypto.randomUUID()) {
    const run = (0, inventoryRepository_shared_1.withDatabase)(getConnection);
    return {
        listByProduct(productId) {
            return run(async (db) => (await db.select(`SELECT ${COLUMNS} FROM product_units WHERE product_id=$1 ORDER BY name,id`, [(0, inventoryRepository_shared_1.requiredText)(productId, "productId")])).map(mapProductUnit));
        },
        /** Backwards-compatible name used by the earlier Day 2 UI. */
        listForProduct(productId) {
            return this.listByProduct(productId);
        },
        findById(id) {
            return run(async (db) => {
                const rows = await db.select(`SELECT ${COLUMNS} FROM product_units WHERE id=$1`, [(0, inventoryRepository_shared_1.requiredText)(id, "id")]);
                return rows[0] ? mapProductUnit(rows[0]) : null;
            });
        },
        /** Returns inactive matches too, so barcode identification explains status. */
        findByBarcode(barcode) {
            return run(async (db) => {
                const normalized = (0, inventoryRepository_shared_1.requiredText)(barcode, "barcode", 100);
                const rows = await db.select(`SELECT ${COLUMNS} FROM product_units WHERE barcode=$1`, [normalized]);
                return rows[0] ? mapProductUnit(rows[0]) : null;
            });
        },
        create(input) {
            return run(async (db) => {
                const value = await normalize(db, input);
                const id = createId();
                await db.execute(`INSERT INTO product_units
           (id,product_id,name,quantity_in_base_units,barcode,pack_description,can_purchase,can_sell)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [id, value.productId, value.name, value.quantityInBaseUnits,
                    value.barcode || null, value.packDescription || null,
                    value.canPurchase ? 1 : 0, value.canSell ? 1 : 0]);
                return id;
            });
        },
        update(productId, unitId, changes) {
            return run(async (db) => {
                const productKey = (0, inventoryRepository_shared_1.requiredText)(productId, "productId");
                const unitKey = (0, inventoryRepository_shared_1.requiredText)(unitId, "unitId");
                const existing = await getRaw(db, productKey, unitKey);
                if (!existing)
                    throw new inventoryRepository_shared_1.InventoryRepositoryError("NOT_FOUND", "Package was not found for this product.");
                const value = await normalize(db, { ...changes, productId: productKey });
                const result = await db.execute(`UPDATE product_units SET name=$1,quantity_in_base_units=$2,barcode=$3,
           pack_description=$4,can_purchase=$5,can_sell=$6 WHERE product_id=$7 AND id=$8`, [value.name, value.quantityInBaseUnits, value.barcode || null,
                    value.packDescription || null, value.canPurchase ? 1 : 0, value.canSell ? 1 : 0,
                    productKey, unitKey]);
                (0, inventoryRepository_shared_1.ensureOneRow)(result.rowsAffected, "Package");
                return mapProductUnit({ ...existing, name: value.name,
                    quantity_in_base_units: value.quantityInBaseUnits,
                    barcode: value.barcode || null, pack_description: value.packDescription || null,
                    can_purchase: value.canPurchase ? 1 : 0, can_sell: value.canSell ? 1 : 0 });
            });
        },
        deactivate(productId, unitId) {
            return run(async (db) => {
                const productKey = (0, inventoryRepository_shared_1.requiredText)(productId, "productId");
                const unitKey = (0, inventoryRepository_shared_1.requiredText)(unitId, "unitId");
                const result = await db.execute("UPDATE product_units SET is_active=0 WHERE product_id=$1 AND id=$2 AND is_active=1", [productKey, unitKey]);
                (0, inventoryRepository_shared_1.ensureOneRow)(result.rowsAffected, "Active package");
                const rows = await db.select(`SELECT ${COLUMNS} FROM product_units WHERE product_id=$1 AND id=$2`, [productKey, unitKey]);
                if (!rows[0])
                    throw new inventoryRepository_shared_1.InventoryRepositoryError("NOT_FOUND", "Package was not found for this product.");
                return mapProductUnit(rows[0]);
            });
        },
    };
}
