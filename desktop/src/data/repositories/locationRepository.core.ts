import {
  ensureOneRow, InventoryRepositoryError, nonnegativeInteger,
  requiredText, withDatabase,
  type GetConnection, type SqlClient,
} from "./inventoryRepository.shared";

export type LocationType = "ROOM" | "AISLE" | "SHELF" | "SECTION" | "BIN" | "OTHER";
export type ShelfPosition = "TOP" | "MIDDLE" | "BOTTOM";

export interface LocationInput {
  branchId: string;
  parentLocationId: string | null;
  code: string;
  name: string;
  type: LocationType;
  position: ShelfPosition | null;
  sortOrder: number;
}
export type LocationEdit = Omit<LocationInput, "branchId">;

export interface LocationRecord extends LocationInput {
  readonly id: string;
}
interface LocationRow {
  id: string; branch_id: string; parent_location_id: string | null;
  code: string; name: string; type: LocationType;
  position: ShelfPosition | null; sort_order: number;
}
const COLUMNS = "id,branch_id,parent_location_id,code,name,type,position,sort_order";
const TYPES: readonly LocationType[] = ["ROOM","AISLE","SHELF","SECTION","BIN","OTHER"];
const POSITIONS: readonly ShelfPosition[] = ["TOP","MIDDLE","BOTTOM"];

export function mapLocation(row: LocationRow): LocationRecord {
  return {
    id: row.id, branchId: row.branch_id, parentLocationId: row.parent_location_id,
    code: row.code, name: row.name, type: row.type,
    position: row.position, sortOrder: row.sort_order,
  };
}

function normalize(input: LocationInput): LocationInput {
  const type = input.type;
  if (!TYPES.includes(type))
    throw new InventoryRepositoryError("INVALID_INPUT", "Choose a supported location type.", "type");
  if (input.position !== null && !POSITIONS.includes(input.position))
    throw new InventoryRepositoryError("INVALID_INPUT", "Position must be Top, Middle or Bottom.", "position");
  if (input.position && type !== "SECTION")
    throw new InventoryRepositoryError("INVALID_INPUT", "Only a SECTION may have a Top/Middle/Bottom position.", "position");
  if (input.parentLocationId !== null && (typeof input.parentLocationId !== "string" || !input.parentLocationId.trim()))
    throw new InventoryRepositoryError("INVALID_INPUT", "Enter a valid parent location ID.", "parentLocationId");
  return {
    branchId: requiredText(input.branchId, "branchId"),
    parentLocationId: input.parentLocationId?.trim() ?? null,
    code: requiredText(input.code, "code", 60),
    name: requiredText(input.name, "name", 120),
    type, position: input.position,
    sortOrder: nonnegativeInteger(input.sortOrder, "sortOrder"),
  };
}

async function getRaw(db: SqlClient, id: string): Promise<LocationRow | null> {
  const rows = await db.select<LocationRow[]>(
    `SELECT ${COLUMNS} FROM locations WHERE id=$1`, [id],
  );
  return rows[0] ?? null;
}

/** Prevent missing/cross-branch parents and cycles in the current snapshot.
 * For race-free concurrent reparenting, perform this check + UPDATE atomically
 * inside a single native transaction. Plain pooled plugin calls are NOT atomic.
 */
async function verifyHierarchy(
  db: SqlClient, branchId: string, parentId: string | null,
  ownId: string | null, position: ShelfPosition | null,
): Promise<void> {
  if (parentId === null) {
    if (position !== null)
      throw new InventoryRepositoryError("INVALID_PARENT", "A shelf section with a position needs a shelf parent.", "parentLocationId");
    return;
  }
  const visited = new Set<string>();
  let currentId: string | null = parentId;
  let depth = 0;
  while (currentId !== null) {
    if (currentId === ownId || visited.has(currentId))
      throw new InventoryRepositoryError("LOCATION_CYCLE", "A location cannot be its own parent or descendant.", "parentLocationId");
    if (++depth > 100)
      throw new InventoryRepositoryError("LOCATION_CYCLE", "The location hierarchy is too deep or contains a cycle.", "parentLocationId");
    visited.add(currentId);
    const current: LocationRow | null = await getRaw(db, currentId);
    if (!current || current.branch_id !== branchId)
      throw new InventoryRepositoryError("INVALID_PARENT", "The parent location must exist in the same branch.", "parentLocationId");
    if (currentId === parentId && position !== null && current.type !== "SHELF")
      throw new InventoryRepositoryError("INVALID_PARENT", "Top/Middle/Bottom must be inside a shelf.", "parentLocationId");
    currentId = current.parent_location_id;
  }
}

export function makeLocationRepository(
  getConnection: GetConnection,
  createId: () => string = () => crypto.randomUUID(),
) {
  const run = withDatabase(getConnection);
  return {
    listByBranch(branchId: string): Promise<LocationRecord[]> {
      return run(async db => (await db.select<LocationRow[]>(
        `SELECT ${COLUMNS} FROM locations WHERE branch_id=$1
         ORDER BY sort_order,name,id`, [requiredText(branchId, "branchId")],
      )).map(mapLocation));
    },
    findById(id: string): Promise<LocationRecord | null> {
      return run(async db => {
        const row = await getRaw(db, requiredText(id, "id"));
        return row ? mapLocation(row) : null;
      });
    },
    findByCode(branchId: string, code: string): Promise<LocationRecord | null> {
      return run(async db => {
        const rows = await db.select<LocationRow[]>(
          `SELECT ${COLUMNS} FROM locations WHERE branch_id=$1 AND code=$2`,
          [requiredText(branchId,"branchId"), requiredText(code,"code")],
        );
        return rows[0] ? mapLocation(rows[0]) : null;
      });
    },
    create(input: LocationInput): Promise<LocationRecord> {
      return run(async db => {
        const value = normalize(input);
        const branches = await db.select<{ id: string }[]>(
          "SELECT id FROM branches WHERE id=$1", [value.branchId],
        );
        if (branches.length === 0)
          throw new InventoryRepositoryError("INVALID_PARENT", "Select an existing branch.", "branchId");
        await verifyHierarchy(db, value.branchId, value.parentLocationId, null, value.position);
        const id = createId();
        await db.execute(
          `INSERT INTO locations
           (id,branch_id,parent_location_id,code,name,type,position,sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [id,value.branchId,value.parentLocationId,value.code,value.name,
            value.type,value.position,value.sortOrder],
        );
        return { id, ...value };
      });
    },
    update(id: string, changes: LocationEdit): Promise<LocationRecord> {
      return run(async db => {
        const key = requiredText(id, "id");
        const current = await getRaw(db, key);
        if (!current) throw new InventoryRepositoryError("NOT_FOUND", "Location not found.");
        const value = normalize({ ...changes, branchId: current.branch_id });
        await verifyHierarchy(db,current.branch_id,value.parentLocationId,key,value.position);
        const result = await db.execute(
          `UPDATE locations SET parent_location_id=$1,code=$2,name=$3,
           type=$4,position=$5,sort_order=$6 WHERE id=$7`,
          [value.parentLocationId,value.code,value.name,value.type,
            value.position,value.sortOrder,key],
        );
        ensureOneRow(result.rowsAffected,"Location");
        return { id:key,...value };
      });
    },
    /** Includes branch name, then every parent, ending with the selected location. */
    getDisplayPath(id: string): Promise<string> {
      return run(async db => {
        let currentId: string | null = requiredText(id,"id");
        const visited = new Set<string>();
        const names: string[] = [];
        let branchId: string | null = null;
        while (currentId !== null) {
          if (visited.has(currentId) || visited.size >= 100)
            throw new InventoryRepositoryError("LOCATION_CYCLE", "Cannot display a cyclic location hierarchy.");
          visited.add(currentId);
          const row: LocationRow | null = await getRaw(db,currentId);
          if (!row) throw new InventoryRepositoryError("NOT_FOUND", "Location path is incomplete.");
          if (branchId !== null && row.branch_id !== branchId)
            throw new InventoryRepositoryError("INVALID_PARENT", "Location path crosses branches.");
          branchId = row.branch_id;
          names.unshift(row.name);
          currentId = row.parent_location_id;
        }
        const branches = await db.select<{name:string}[]>(
          "SELECT name FROM branches WHERE id=$1", [branchId],
        );
        if (!branches[0]) throw new InventoryRepositoryError("NOT_FOUND", "Branch not found.");
        return [branches[0].name,...names].join(" → ");
      });
    },
  };
}
