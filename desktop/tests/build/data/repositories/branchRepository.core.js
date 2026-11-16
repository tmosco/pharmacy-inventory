"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapBranch = mapBranch;
exports.makeBranchRepository = makeBranchRepository;
const inventoryRepository_shared_1 = require("./inventoryRepository.shared");
function mapBranch(row) {
    return {
        id: row.id, code: row.code, name: row.name,
        street: row.street, city: row.city, region: row.region,
        country: row.country, createdAt: row.created_at,
    };
}
function normalize(input) {
    return {
        code: (0, inventoryRepository_shared_1.requiredText)(input.code, "code", 40),
        name: (0, inventoryRepository_shared_1.requiredText)(input.name, "name", 120),
        street: (0, inventoryRepository_shared_1.nullableText)(input.street, "street", 200),
        city: (0, inventoryRepository_shared_1.nullableText)(input.city, "city", 120),
        region: (0, inventoryRepository_shared_1.nullableText)(input.region, "region", 120),
        country: (0, inventoryRepository_shared_1.nullableText)(input.country, "country", 120),
    };
}
const COLUMNS = "id,code,name,street,city,region,country,created_at";
function makeBranchRepository(getConnection, createId = () => crypto.randomUUID()) {
    const run = (0, inventoryRepository_shared_1.withDatabase)(getConnection);
    async function findById(id) {
        return run(async (db) => {
            const rows = await db.select(`SELECT ${COLUMNS} FROM branches WHERE id=$1`, [(0, inventoryRepository_shared_1.requiredText)(id, "id")]);
            return rows[0] ? mapBranch(rows[0]) : null;
        });
    }
    return {
        findById,
        list() {
            return run(async (db) => (await db.select(`SELECT ${COLUMNS} FROM branches ORDER BY name,id`)).map(mapBranch));
        },
        findByCode(code) {
            return run(async (db) => {
                const rows = await db.select(`SELECT ${COLUMNS} FROM branches WHERE code=$1`, [(0, inventoryRepository_shared_1.requiredText)(code, "code")]);
                return rows[0] ? mapBranch(rows[0]) : null;
            });
        },
        create(input) {
            return run(async (db) => {
                const b = normalize(input);
                const id = createId();
                const createdAt = new Date().toISOString();
                await db.execute(`INSERT INTO branches (id,code,name,street,city,region,country,created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [id, b.code, b.name, b.street, b.city, b.region, b.country, createdAt]);
                // The INSERT already committed. Do not risk reporting a failed save
                // because a subsequent refresh query happens to fail.
                return { id, ...b, createdAt };
            });
        },
        update(id, input) {
            return run(async (db) => {
                const key = (0, inventoryRepository_shared_1.requiredText)(id, "id");
                const b = normalize(input);
                const existing = await db.select(`SELECT ${COLUMNS} FROM branches WHERE id=$1`, [key]);
                if (!existing[0]) {
                    (0, inventoryRepository_shared_1.ensureOneRow)(0, "Branch");
                }
                const result = await db.execute(`UPDATE branches SET code=$1,name=$2,street=$3,city=$4,region=$5,country=$6
           WHERE id=$7`, [b.code, b.name, b.street, b.city, b.region, b.country, key]);
                (0, inventoryRepository_shared_1.ensureOneRow)(result.rowsAffected, "Branch");
                return { id: key, ...b, createdAt: existing[0].created_at };
            });
        },
    };
}
