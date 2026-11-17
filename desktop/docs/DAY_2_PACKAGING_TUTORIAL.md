# Day 2 — Product units and packaging

## What this lesson teaches

This lesson models the same medicine in the package sizes used for buying and selling. Every package factor points directly to the product's base unit. If the base unit is tablet, Tablet = 1, Strip = 10, Box = 100 and Carton = 1,000. A box does not point to a strip; its factor is already the number of tablets in the box.

The form's preview uses `toBaseUnits` to calculate a quantity for display. For example, 2 boxes + 3 strips + 4 tablets is 200 + 30 + 4 = 234 tablets. This preview never writes inventory or changes a stock balance.

## Files to study

1. `src/features/products/utils/unitConversion.ts` — a small pure function that validates whole quantities and safely multiplies them.
2. `src/features/products/components/ProductUnitForm.tsx` — React Hook Form and Zod validation, a conversion preview, barcode text input, and purchase/sale choices.
3. `src/features/products/components/ProductUnitList.tsx` — the per-product list, including conversion, barcode, eligibility, status and edit/deactivate actions.
4. `src/data/repositories/productUnitRepository.core.ts` — SQLite create/list/find/update/deactivate behavior. Notice that `update` and `deactivate` both require the product ID and unit ID.
5. `src-tauri/migrations/002_product_unit_eligibility.sql` — adds the three status flags. It does not rewrite old conversion factors.
6. `src/pages/Products.tsx` — connects the form/list to the repository and reloads that product's units after a saved change.

## How to follow the code

1. Open a product and expand its packaging section. The page calls `listByProduct(productId)`, so the table belongs to that product only.
2. Choose **Add packaging**. Enter a name and a positive whole number for “Base-unit quantity per package.” Keep a barcode as text; leading zeros are significant.
3. Change the preview quantity and conversion factor. The preview updates immediately. Try a fraction, zero or a very large result to see why both inputs and multiplication are checked.
4. Choose whether this package can be used for purchasing and selling. Those flags are stored as booleans in TypeScript and 0/1 in SQLite.
5. Save. The page writes through `productUnitRepository`, closes the editor only after success, and reads the product's unit list again. If a duplicate name or barcode is rejected, the form shows an error and keeps what you typed.
6. Edit a package and save. The repository scopes the update with both IDs, so a unit cannot accidentally be changed under another product.
7. Deactivate a package. It remains in the list and its barcode remains reserved. `findByBarcode` returns the inactive record so a later receiving or sales workflow can explain why it cannot be used.

The repository also exposes `assertProductUnitAllowed(unit, "PURCHASE" | "SALE")`. When purchasing and sales screens are built, they should call it after barcode lookup. The current app does not yet have those transaction flows wired to these flags.

## Checkpoint practice

Add Tablet = 1, Strip = 10 and Box = 100 to one product. Add Carton = 1,000 if it is useful for that medicine. Use distinct barcode strings such as `0001`, `0002`, and `0003` to see that leading zeros remain intact.

Check that 2 boxes + 3 strips + 4 tablets previews as 234 base units. Try adding a duplicate package name and duplicate barcode. Edit a package, close and reopen the product, then restart the Tauri app. Deactivate Box and confirm it stays visible as inactive and the barcode cannot be reused.

The automated SQLite checks use disposable databases. To run them from `desktop`, use `bash scripts-run-tests.sh`. To compile the app, use `npm run build`.

## Existing fractional conversion factors

The earlier form allowed decimal factors. This migration leaves existing rows untouched, and the new form/repository accepts only positive whole-number factors. Review any old decimal factors before changing them; do not round them automatically. On a copy of the database, inspect them with:

```sql
SELECT id, product_id, name, quantity_in_base_units
FROM product_units
WHERE quantity_in_base_units != CAST(quantity_in_base_units AS INTEGER);
```

The migration prevents new or edited fractional factors but allows pre-existing fractional rows to remain readable until reviewed. If the business needs fractional package conversions later, decide the base unit and precision rules explicitly before extending the model.
