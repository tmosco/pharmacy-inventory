# Week 5 — Branch, Location, and Product Unit repositories

This is a **merge patch** for your React + TypeScript + Tauri 2 application, not a replacement for your current project. It uses the database columns in the **initial catalog SQL supplied earlier**, with `branches`, `locations`, `products`, and `product_units` already migrated.

## What is included

- `branchRepository.ts` + `.core.ts`: list, find by ID/code, create, update.
- `locationRepository.ts` + `.core.ts`: branch-filtered list, ID/code lookup, create, update, and complete location path; checks parent/branch/position and detects cycles in current data.
- `productUnitRepository.ts` + `.core.ts`: list per product, find by ID/barcode, create, update; validates conversion against `products.quantity_precision`; `create()` returns a string ID, compatible with the earlier ProductUnitForm.
- `inventoryRepository.shared.ts`: database adapter types, parameter binding helper, validation and user-safe errors.
- `tests/`: 16 real-SQLite tests against disposable database files and a **REFERENCE-ONLY** copy of the earlier migration SQL.
- `desktop/scripts-run-tests.sh`: compiles the testable cores and runs Node tests. Run from desktop in this patch; Node 22+ and local TypeScript installation needed.

## Safest installation order

1. **Back up** your existing `desktop/src/data/repositories/productUnitRepository.ts` and any customized files.
2. Inspect your real database schema in your Tauri diagnostic component:

   ```ts
   const db = await getDb();
   console.table(await db.select('PRAGMA table_info(branches)'));
   console.table(await db.select('PRAGMA table_info(locations)'));
   console.table(await db.select('PRAGMA table_info(product_units)'));
   console.table(await db.select('PRAGMA table_info(products)'));
   console.table(await db.select('PRAGMA foreign_keys'));
   ```

   These read-only checks reveal if your local schema differs from the reference.
3. Copy the files under `desktop/src/data/repositories/` into your current project. If you already have a custom product-unit repository, merge rather than blindly overwrite. Keep your current `db.ts`, `ProductForm`, `Products.tsx`, router and applied migrations.
4. Confirm `desktop/src/data/db.ts` exports `getDb`, and `getDb()` uses the same `sqlite:pharmacy.db` URL as your Tauri migration registration.
5. Copy `desktop/tests/` and `desktop/scripts-run-tests.sh` into your existing `desktop/` folder. Run the test script **from your actual desktop project**, where TypeScript is installed:

   ```bash
   cd desktop
   bash scripts-run-tests.sh
   ```

   Tests use Node's built-in `node:sqlite` on Node 22.16.0; that version warns that it is experimental. The tests do **not** open your real `pharmacy.db`. The bundled migration file in `tests/fixtures/` is used only for isolated test databases.
6. For your actual project, install no additional dependencies for these repositories if you already have the Tauri SQL plugin and TypeScript from Weeks 3–4. Run `npm run tauri dev` and test an actual branch + location creation in a disposable development database.

## Examples (run only in the Tauri desktop app)

```ts
import { branchRepository } from './data/repositories/branchRepository';
import { locationRepository } from './data/repositories/locationRepository';
import { productUnitRepository } from './data/repositories/productUnitRepository';

const branch = await branchRepository.create({
  code: 'MAIN', name: 'Main Branch', city: 'Ikeja', country: 'Nigeria',
});
const shelf = await locationRepository.create({
  branchId: branch.id, parentLocationId: null,
  code: 'A-01', name: 'Analgesics', type: 'SHELF',
  position: null, sortOrder: 1,
});
const top = await locationRepository.create({
  branchId: branch.id, parentLocationId: shelf.id,
  code: 'A-01-T', name: 'Top', type: 'SECTION',
  position: 'TOP', sortOrder: 1,
});
console.log(await locationRepository.getDisplayPath(top.id));
// "Main Branch → Analgesics → Top"

// After a real product exists:
const units = await productUnitRepository.listForProduct(productId);
const newId = await productUnitRepository.create({
  productId, name: 'Box', quantityInBaseUnits: 100,
  barcode: '000123', packDescription: '10 blisters × 10 tablets',
});
```

## No new migration required for the three baseline repositories

They use the tables/columns in the supplied catalog migration. **Do not register the bundled test fixture as a new Tauri migration** and do not delete/re-create your existing DB.

The current schema does **not yet have** `branches.is_active`, `locations.is_active`, `locations.scan_code`, `product_units.is_active`, `product_units.can_purchase`, `product_units.can_sell` or a product preferred-location table. Their corresponding features are planned next, through numbered additive migrations after you inspect your live schema and back it up.

## Known limitations and safety

- The core repositories call the Tauri SQL plugin. The webview needs `sql:allow-execute` for writes in this learning setup, which grants broad SQL execution. Review or move writes to narrow Rust commands before production.
- The schema assumes one business per database, and location codes are unique **within each branch**. A single packaging barcode is unique across the database.
- Parent/descendant checking uses multiple reads before an update. It prevents ordinary errors, but it is **not race-safe** for concurrent location moves through a connection pool. Move this validation and update into one trusted native transaction when implementing concurrent editing.
- No deletion or deactivation methods are provided because the current tables lack an active/status field for branches, units, and locations. Add audited status via a later migration instead of destructive deletes.
- Changing a packaging conversion can affect inventory quantities after stock/sales exist. Lock or version conversions after inventory records start referencing them.
- No stock-quantity or expiry data lives in these repositories. Purchase batches, stock placement and ledger belong to the later inventory work.
- Real native Tauri builds and UI workflow have **not** been run against your current local project. Test in your own `desktop/` app.

## Read next

See the separate Word report `Week_5_Repository_Implementation_and_Next_Steps.docx` for a detailed learning guide, integration order, migration plan, UI components, validation rules, and acceptance tests.
