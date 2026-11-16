import {
  ensureOneRow, InventoryRepositoryError, nullableText, requiredText,
  withDatabase, type GetConnection, type SqlClient,
} from "./inventoryRepository.shared";

/** Compatible with the existing Day 5 ProductUnitForm save callback. */
export interface NewProductUnit {
  productId: string;
  name: string;
  quantityInBaseUnits: number;
  barcode: string;
  packDescription: string;
}
export type ProductUnitChanges = Omit<NewProductUnit, "productId">;

export interface ProductUnitRecord {
  readonly id: string;
  productId: string;
  name: string;
  quantityInBaseUnits: number;
  barcode: string;
  packDescription: string;
}
interface ProductUnitRow {
  id:string; product_id:string; name:string; quantity_in_base_units:number;
  barcode:string|null; pack_description:string|null;
}
interface ProductConfigRow { id:string; quantity_precision:number; }
const COLUMNS = "id,product_id,name,quantity_in_base_units,barcode,pack_description";
export function mapProductUnit(row: ProductUnitRow): ProductUnitRecord {
  return {
    id:row.id, productId:row.product_id, name:row.name,
    quantityInBaseUnits:row.quantity_in_base_units,
    barcode:row.barcode ?? "", packDescription:row.pack_description ?? "",
  };
}

async function getRaw(db:SqlClient,id:string):Promise<ProductUnitRow|null> {
  const rows = await db.select<ProductUnitRow[]>(
    `SELECT ${COLUMNS} FROM product_units WHERE id=$1`,[id]);
  return rows[0] ?? null;
}

async function normalize(db:SqlClient,input:NewProductUnit):Promise<NewProductUnit> {
  const productId = requiredText(input.productId,"productId");
  const products = await db.select<ProductConfigRow[]>(
    "SELECT id,quantity_precision FROM products WHERE id=$1",[productId]);
  if (!products[0]) throw new InventoryRepositoryError("NOT_FOUND", "Product does not exist.","productId");
  const quantity = input.quantityInBaseUnits;
  if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0)
    throw new InventoryRepositoryError("INVALID_INPUT","Conversion must be a positive finite quantity.","quantityInBaseUnits");
  const precision = products[0].quantity_precision;
  if (!Number.isInteger(precision) || precision < 0 || precision > 3)
    throw new InventoryRepositoryError("INVALID_INPUT","Product has an invalid quantity precision.");
  // Small epsilon handles binary floating point for decimal conversions.
  const scaled = quantity * 10 ** precision;
  if (!Number.isSafeInteger(Math.round(scaled)) || Math.abs(scaled - Math.round(scaled)) > 1e-8)
    throw new InventoryRepositoryError("INVALID_INPUT",
      `This product allows at most ${precision} decimal place(s) in base-unit quantities.`,
      "quantityInBaseUnits");
  return {
    productId,
    name:requiredText(input.name,"name",120),
    quantityInBaseUnits:quantity,
    barcode:nullableText(input.barcode,"barcode",100) ?? "",
    packDescription:nullableText(input.packDescription,"packDescription",500) ?? "",
  };
}

export function makeProductUnitRepository(
  getConnection:GetConnection,
  createId:()=>string=()=>crypto.randomUUID(),
) {
  const run = withDatabase(getConnection);
  return {
    listForProduct(productId:string):Promise<ProductUnitRecord[]> {
      return run(async db => (await db.select<ProductUnitRow[]>(
        `SELECT ${COLUMNS} FROM product_units WHERE product_id=$1 ORDER BY name,id`,
        [requiredText(productId,"productId")])).map(mapProductUnit));
    },
    findById(id:string):Promise<ProductUnitRecord|null> {
      return run(async db => {
        const row = await getRaw(db,requiredText(id,"id"));
        return row ? mapProductUnit(row) : null;
      });
    },
    findByBarcode(barcode:string):Promise<ProductUnitRecord|null> {
      return run(async db => {
        const normalized = requiredText(barcode,"barcode",100);
        const rows = await db.select<ProductUnitRow[]>(
          `SELECT ${COLUMNS} FROM product_units WHERE barcode=$1`,[normalized]);
        return rows[0] ? mapProductUnit(rows[0]) : null;
      });
    },
    /** Returns the new unit ID for compatibility with your existing UI. */
    create(input:NewProductUnit):Promise<string> {
      return run(async db => {
        const value = await normalize(db,input);
        const id = createId();
        await db.execute(
          `INSERT INTO product_units
           (id,product_id,name,quantity_in_base_units,barcode,pack_description)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [id,value.productId,value.name,value.quantityInBaseUnits,
            value.barcode || null,value.packDescription || null],
        );
        return id;
      });
    },
    update(id:string,changes:ProductUnitChanges):Promise<ProductUnitRecord> {
      return run(async db => {
        const key = requiredText(id,"id");
        const existing = await getRaw(db,key);
        if (!existing) throw new InventoryRepositoryError("NOT_FOUND","Packaging unit not found.");
        const value = await normalize(db,{...changes,productId:existing.product_id});
        const result = await db.execute(
          `UPDATE product_units SET name=$1,quantity_in_base_units=$2,
           barcode=$3,pack_description=$4 WHERE id=$5`,
          [value.name,value.quantityInBaseUnits,value.barcode || null,
            value.packDescription || null,key],
        );
        ensureOneRow(result.rowsAffected,"Packaging unit");
        return {id:key,...value};
      });
    },
  };
}
