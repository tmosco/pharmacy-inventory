"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapLocation = mapLocation;
exports.makeLocationRepository = makeLocationRepository;
const inventoryRepository_shared_1 = require("./inventoryRepository.shared");
const COLUMNS = "id,branch_id,parent_location_id,code,name,type,position,sort_order";
const TYPES = ["ROOM", "AISLE", "SHELF", "SECTION", "BIN", "OTHER"];
const POSITIONS = ["TOP", "MIDDLE", "BOTTOM"];
function mapLocation(row) {
    return {
        id: row.id, branchId: row.branch_id, parentLocationId: row.parent_location_id,
        code: row.code, name: row.name, type: row.type,
        position: row.position, sortOrder: row.sort_order,
    };
}
function normalize(input) {
    const type = input.type;
    if (!TYPES.includes(type))
        throw new inventoryRepository_shared_1.InventoryRepositoryError("INVALID_INPUT", "Choose a supported location type.", "type");
    if (input.position !== null && !POSITIONS.includes(input.position))
        throw new inventoryRepository_shared_1.InventoryRepositoryError("INVALID_INPUT", "Position must be Top, Middle or Bottom.", "position");
    if (input.position && type !== "SECTION")
        throw new inventoryRepository_shared_1.InventoryRepositoryError("INVALID_INPUT", "Only a SECTION may have a Top/Middle/Bottom position.", "position");
    if (input.parentLocationId !== null && (typeof input.parentLocationId !== "string" || !input.parentLocationId.trim()))
        throw new inventoryRepository_shared_1.InventoryRepositoryError("INVALID_INPUT", "Enter a valid parent location ID.", "parentLocationId");
    return {
        branchId: (0, inventoryRepository_shared_1.requiredText)(input.branchId, "branchId"),
        parentLocationId: input.parentLocationId?.trim() ?? null,
        code: (0, inventoryRepository_shared_1.requiredText)(input.code, "code", 60),
        name: (0, inventoryRepository_shared_1.requiredText)(input.name, "name", 120),
        type, position: input.position,
        sortOrder: (0, inventoryRepository_shared_1.nonnegativeInteger)(input.sortOrder, "sortOrder"),
    };
}
async function getRaw(db, id) {
    const rows = await db.select(`SELECT ${COLUMNS} FROM locations WHERE id=$1`, [id]);
    return rows[0] ?? null;
}
/** Prevent missing/cross-branch parents and cycles in the current snapshot.
 * For race-free concurrent reparenting, perform this check + UPDATE atomically
 * inside a single native transaction. Plain pooled plugin calls are NOT atomic.
 */
async function verifyHierarchy(db, branchId, parentId, ownId, position) {
    if (parentId === null) {
        if (position !== null)
            throw new inventoryRepository_shared_1.InventoryRepositoryError("INVALID_PARENT", "A shelf section with a position needs a shelf parent.", "parentLocationId");
        return;
    }
    const visited = new Set();
    let currentId = parentId;
    let depth = 0;
    while (currentId !== null) {
        if (currentId === ownId || visited.has(currentId))
            throw new inventoryRepository_shared_1.InventoryRepositoryError("LOCATION_CYCLE", "A location cannot be its own parent or descendant.", "parentLocationId");
        if (++depth > 100)
            throw new inventoryRepository_shared_1.InventoryRepositoryError("LOCATION_CYCLE", "The location hierarchy is too deep or contains a cycle.", "parentLocationId");
        visited.add(currentId);
        const current = await getRaw(db, currentId);
        if (!current || current.branch_id !== branchId)
            throw new inventoryRepository_shared_1.InventoryRepositoryError("INVALID_PARENT", "The parent location must exist in the same branch.", "parentLocationId");
        if (currentId === parentId && position !== null && current.type !== "SHELF")
            throw new inventoryRepository_shared_1.InventoryRepositoryError("INVALID_PARENT", "Top/Middle/Bottom must be inside a shelf.", "parentLocationId");
        currentId = current.parent_location_id;
    }
}
function makeLocationRepository(getConnection, createId = () => crypto.randomUUID()) {
    const run = (0, inventoryRepository_shared_1.withDatabase)(getConnection);
    return {
        listByBranch(branchId) {
            return run(async (db) => (await db.select(`SELECT ${COLUMNS} FROM locations WHERE branch_id=$1
         ORDER BY sort_order,name,id`, [(0, inventoryRepository_shared_1.requiredText)(branchId, "branchId")])).map(mapLocation));
        },
        findById(id) {
            return run(async (db) => {
                const row = await getRaw(db, (0, inventoryRepository_shared_1.requiredText)(id, "id"));
                return row ? mapLocation(row) : null;
            });
        },
        findByCode(branchId, code) {
            return run(async (db) => {
                const rows = await db.select(`SELECT ${COLUMNS} FROM locations WHERE branch_id=$1 AND code=$2`, [(0, inventoryRepository_shared_1.requiredText)(branchId, "branchId"), (0, inventoryRepository_shared_1.requiredText)(code, "code")]);
                return rows[0] ? mapLocation(rows[0]) : null;
            });
        },
        create(input) {
            return run(async (db) => {
                const value = normalize(input);
                const branches = await db.select("SELECT id FROM branches WHERE id=$1", [value.branchId]);
                if (branches.length === 0)
                    throw new inventoryRepository_shared_1.InventoryRepositoryError("INVALID_PARENT", "Select an existing branch.", "branchId");
                await verifyHierarchy(db, value.branchId, value.parentLocationId, null, value.position);
                const id = createId();
                await db.execute(`INSERT INTO locations
           (id,branch_id,parent_location_id,code,name,type,position,sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [id, value.branchId, value.parentLocationId, value.code, value.name,
                    value.type, value.position, value.sortOrder]);
                return { id, ...value };
            });
        },
        update(id, changes) {
            return run(async (db) => {
                const key = (0, inventoryRepository_shared_1.requiredText)(id, "id");
                const current = await getRaw(db, key);
                if (!current)
                    throw new inventoryRepository_shared_1.InventoryRepositoryError("NOT_FOUND", "Location not found.");
                const value = normalize({ ...changes, branchId: current.branch_id });
                await verifyHierarchy(db, current.branch_id, value.parentLocationId, key, value.position);
                const result = await db.execute(`UPDATE locations SET parent_location_id=$1,code=$2,name=$3,
           type=$4,position=$5,sort_order=$6 WHERE id=$7`, [value.parentLocationId, value.code, value.name, value.type,
                    value.position, value.sortOrder, key]);
                (0, inventoryRepository_shared_1.ensureOneRow)(result.rowsAffected, "Location");
                return { id: key, ...value };
            });
        },
        /** Includes branch name, then every parent, ending with the selected location. */
        getDisplayPath(id) {
            return run(async (db) => {
                let currentId = (0, inventoryRepository_shared_1.requiredText)(id, "id");
                const visited = new Set();
                const names = [];
                let branchId = null;
                while (currentId !== null) {
                    if (visited.has(currentId) || visited.size >= 100)
                        throw new inventoryRepository_shared_1.InventoryRepositoryError("LOCATION_CYCLE", "Cannot display a cyclic location hierarchy.");
                    visited.add(currentId);
                    const row = await getRaw(db, currentId);
                    if (!row)
                        throw new inventoryRepository_shared_1.InventoryRepositoryError("NOT_FOUND", "Location path is incomplete.");
                    if (branchId !== null && row.branch_id !== branchId)
                        throw new inventoryRepository_shared_1.InventoryRepositoryError("INVALID_PARENT", "Location path crosses branches.");
                    branchId = row.branch_id;
                    names.unshift(row.name);
                    currentId = row.parent_location_id;
                }
                const branches = await db.select("SELECT name FROM branches WHERE id=$1", [branchId]);
                if (!branches[0])
                    throw new inventoryRepository_shared_1.InventoryRepositoryError("NOT_FOUND", "Branch not found.");
                return [branches[0].name, ...names].join(" → ");
            });
        },
    };
}
