# Day 4 — Product repository (React + Tauri + SQLite)

This is an **additive learning patch**. Copy `desktop/src/data/repositories/` into your own `desktop/src/data/repositories/` folder.

## Prerequisites

1. Day 2: `src/data/db.ts` exports `getDb()` and uses `sqlite:pharmacy.db`.
2. Day 3: migration 001 has run and `products` has `id`, `sku`, `name`, `brand_name`, `strength`, `dosage_form`, `base_unit`, `reorder_level`, and `status`. Use the original bundled 001 or, if already applied, an appropriate separately registered 002. Do not rerun a conflicting 002 on the new 001.
3. Tauri `src-tauri/capabilities/default.json` includes `sql:default` for reads. To try `create`, `update`, or `deactivate` using the frontend SQL plugin, you also need `sql:allow-execute` for the relevant window. This is **broad SQL write access**; appropriate only as a carefully reviewed local learning step. For production, prefer narrowly scoped Rust commands that validate and authorize writes.
4. `src-tauri/src/lib.rs` registers the SQL plugin only once.

## Use without opening React

For now, create a temporary development-only function or call from a dev-only view:

```ts
import { productRepository } from "./data/repositories/productRepository";

const all = await productRepository.list();
console.table(all);

const newProduct = await productRepository.create({
  sku: "PARA-500",
  genericName: "Paracetamol 500mg",
  brandName: "",
  strength: "500mg",
  dosageForm: "Tablet",
  baseUnit: "TABLET",
  reorderLevel: 20,
});
console.log(newProduct);

console.log(await productRepository.findById(newProduct.id));
await productRepository.deactivate(newProduct.id);
console.table(await productRepository.list());
```

Use another unique SKU if `PARA-500` already exists. This code **writes to the actual local database** if called from your Tauri app. Do not use real business data while learning.

## Six operations

- list: all products, including inactive
- findById: a product or null
- findByBarcode: returns the packaging unit, converted base-unit quantity, and product (or null); this works only after a `product_units` record with a barcode exists
- create: inserts one record with generated ID and ACTIVE status
- update: changes editable fields, preserves status
- deactivate: sets INACTIVE, does not delete

## Important mapping

Your current React form calls the display name `genericName`. SQLite stores it as `products.name`. Database `brand_name` maps to React `brandName`, with `NULL` translated to `""` for editing. The current repository handles the **seven form fields**, not every optional product column.

## Test core without opening Tauri

This package includes unit tests with a fake SqlClient. They exercise the repository logic, **not** a real SQLite connection. From the ZIP root (Node 18+ and TypeScript compiler installed):

```bash
mkdir -p build
tsc --strict --target ES2022 --module commonjs --lib ES2022,DOM \
  --rootDir desktop/src --outDir build \
  desktop/src/data/repositories/productRepository.core.ts
node --test tests/productRepository.test.cjs
```

On Windows PowerShell, enter the `tsc` command on one line without backslashes.

Separately, verify real SQLite table constraints using `python3 tests/test_schema.py` from the earlier Product Table Migration ZIP, then run the Tauri app and test real native integration.

## Error interpretation

- `no such table: products` — migrations not applied to the same database URL.
- missing column like `reorder_level` — migration schema mismatch.
- denied `sql.execute` — review `sql:allow-execute` capability or native command approach.
- duplicate SKU — repository maps recognized SQLite constraint errors to `DUPLICATE_SKU`; exact native error text can vary, so test locally.
- your `Products.tsx` still uses mock products — expected until Day 5, when you connect the screens.

## Safety notes

Values are always passed as binding parameters (`$1`, `$2`, ...) rather than pasted into SQL strings. The shared `getDb()` Promise is not a database transaction and does not create a native authorization boundary. Do not use separately awaited BEGIN/INSERT/COMMIT statements as a substitute for a connection-pinned transaction for future inventory sales and receiving.
