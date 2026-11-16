import {
  ensureOneRow, nullableText, requiredText, withDatabase,
  type GetConnection,
} from "./inventoryRepository.shared";

export interface BranchInput {
  code: string;
  name: string;
  street?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
}

export interface BranchRecord {
  readonly id: string;
  code: string;
  name: string;
  street: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  createdAt: string;
}

interface BranchRow {
  id: string; code: string; name: string;
  street: string | null; city: string | null;
  region: string | null; country: string | null;
  created_at: string;
}

export function mapBranch(row: BranchRow): BranchRecord {
  return {
    id: row.id, code: row.code, name: row.name,
    street: row.street, city: row.city, region: row.region,
    country: row.country, createdAt: row.created_at,
  };
}

function normalize(input: BranchInput): Required<BranchInput> {
  return {
    code: requiredText(input.code, "code", 40),
    name: requiredText(input.name, "name", 120),
    street: nullableText(input.street, "street", 200),
    city: nullableText(input.city, "city", 120),
    region: nullableText(input.region, "region", 120),
    country: nullableText(input.country, "country", 120),
  };
}

const COLUMNS = "id,code,name,street,city,region,country,created_at";

export function makeBranchRepository(
  getConnection: GetConnection,
  createId: () => string = () => crypto.randomUUID(),
) {
  const run = withDatabase(getConnection);
  async function findById(id: string): Promise<BranchRecord | null> {
    return run(async db => {
      const rows = await db.select<BranchRow[]>(
        `SELECT ${COLUMNS} FROM branches WHERE id=$1`, [requiredText(id, "id")],
      );
      return rows[0] ? mapBranch(rows[0]) : null;
    });
  }
  return {
    findById,
    list(): Promise<BranchRecord[]> {
      return run(async db => (await db.select<BranchRow[]>(
        `SELECT ${COLUMNS} FROM branches ORDER BY name,id`,
      )).map(mapBranch));
    },
    findByCode(code: string): Promise<BranchRecord | null> {
      return run(async db => {
        const rows = await db.select<BranchRow[]>(
          `SELECT ${COLUMNS} FROM branches WHERE code=$1`, [requiredText(code, "code")],
        );
        return rows[0] ? mapBranch(rows[0]) : null;
      });
    },
    create(input: BranchInput): Promise<BranchRecord> {
      return run(async db => {
        const b = normalize(input);
        const id = createId();
        const createdAt = new Date().toISOString();
        await db.execute(
          `INSERT INTO branches (id,code,name,street,city,region,country,created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [id,b.code,b.name,b.street,b.city,b.region,b.country,createdAt],
        );
        // The INSERT already committed. Do not risk reporting a failed save
        // because a subsequent refresh query happens to fail.
        return { id, ...b, createdAt };
      });
    },
    update(id: string, input: BranchInput): Promise<BranchRecord> {
      return run(async db => {
        const key = requiredText(id, "id");
        const b = normalize(input);
        const existing = await db.select<BranchRow[]>(
          `SELECT ${COLUMNS} FROM branches WHERE id=$1`, [key],
        );
        if (!existing[0]) { ensureOneRow(0, "Branch"); }
        const result = await db.execute(
          `UPDATE branches SET code=$1,name=$2,street=$3,city=$4,region=$5,country=$6
           WHERE id=$7`,
          [b.code,b.name,b.street,b.city,b.region,b.country,key],
        );
        ensureOneRow(result.rowsAffected, "Branch");
        return { id: key, ...b, createdAt: existing[0].created_at };
      });
    },
  };
}
