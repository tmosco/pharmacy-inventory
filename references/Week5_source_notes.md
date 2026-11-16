**START HERE**

# **Keep your working architecture**

Do not replace your router, dashboard, modal, connection helper, repository error handling, or existing migrations. Work inside the structure below. Names marked “new” are proposed additions; existing file names stay unchanged.

desktop/\
   src/\
     data/repositories/\
       productRepository.core.ts       # extend\
       productUnitRepository.ts        # extend\
       branchRepository.ts             # new if absent\
       locationRepository.ts           # new\
       productLocationRepository.ts    # new\
     features/products/\
       product.schema.ts               # extend\
       product.types.ts                # keep in sync\
       components/ProductForm.tsx      # extend\
       components/ProductUnitForm.tsx  # reuse + extend\
       components/ProductUnitList.tsx  # new\
     features/locations/               # new feature\
       location.types.ts\
       location.schema.ts\
       locationPath.ts\
       components/LocationForm.tsx\
       components/LocationList.tsx\
       components/ScanLocation.tsx\
       components/LocationLabel.tsx\
     pages/Locations.tsx               # real page\
   src-tauri/migrations/               # append new versions

## **The flow remains the same**

Form → validation → repository → getDb() → SQLite. Read results travel back through the mapper into the UI. A new form field is not finished until it survives this whole round trip.

Your current React field genericName maps to the database column name. Keep that mapping during this week so your form, search, and table continue to work. Use “Product name” as the visible label. A later coordinated rename can change the TypeScript property.

**Completion evidence &#x20;**&#x54;he latest supplied packages are the baseline for this guide. Your current local source was not uploaded for a fresh audit; compare each proposed addition with your files before adding it.



**BEFORE YOU CHANGE THE SCHEMA**

# **Plan only the missing database changes**

First inspect the current database through your existing development verification component. These are read-only checks, not migration statements:

PRAGMA table_info(products);\
 PRAGMA table_info(product_units);\
 PRAGMA table_info(locations);\
 PRAGMA index_list(product_units);\
 PRAGMA foreign_keys;

| **Area**         | **Existing baseline**                                                      | **Proposed additions**                                                        |
| ---------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Product          | category, description, expiry_tracking already exist in the inspected SQL. | manufacturer; storage instructions; restricted and storage-requirement flags. |
| Packaging        | name, conversion, barcode, description, product reference.                 | Active flag; allowed-for-purchasing / selling flags.                          |
| Location         | Branch, parent, code, name, type, position and sort order.                 | Active flag, scan token, usage and storage-capability flags.                  |
| Product location | No preferred-location link in the inspected SQLite product workflow.       | product_location_preferences: one intended location per product/branch.       |



## **How to number the new migrations**

Open the migration list in src-tauri/src/lib.rs and your migrations folder. Use the next unused registered version. If your existing versions are 1 and 2, the next is 3; if only version 1 exists, it may be 2. Do not assume everyone has the same history.

Keep each already-applied file unchanged. Register new SQL files with the existing SQL plugin and the same database URL. Do not add another SQL plugin or rerun ALTER TABLE ADD COLUMN manually at every startup. [T1, T2]

**Safety gate &#x20;**&#x55;se a verified backup and a disposable upgrade test first. Inspect existing rows before introducing stricter rules. Existing fractional conversions or long text must be reviewed—not silently rounded, truncated or deleted.



**DAY 1 • UNDERSTAND THE REMAINING WORK**

# **Complete product details, not product CRUD**

The original Day 1 asks for realistic master records. You already have the basic seven-field form and persistent Add/Edit. Your new task is to complete the descriptive information that the inspected package does not yet expose.

| **Field**                  | **What to do now**                                          | **Why**                                                    |
| -------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| Category                   | Expose the existing category column in the form and mapper. | Group products without tying the category to a shelf name. |
| Description                | Expose the existing description column.                     | Describe the item; keep pack description on its unit.      |
| Expiry tracking            | Expose existing NONE / OPTIONAL / REQUIRED.                 | Describe the product rule, not a single expiry date.       |
| Manufacturer               | Add optional text.                                          | The maker; not the supplier of a particular purchase.      |
| Restricted flag            | Add optional business flag, default false.                  | Identify items requiring the business’s special handling.  |
| Storage instructions       | Add optional text.                                          | Record verified instructions that staff can read.          |
| Cold / secure requirements | Proposed independent flags.                                 | Allow a simple compatibility check against locations.      |



## **Use two sample products**

Example A: a tablet product can have strength and dosage form, a manufacturer, and REQUIRED expiry tracking. Example B: a hammer can leave medicine-specific fields blank and use NONE. Both retain the same Product Form and repository.

Do not invent handling instructions or infer them from a medicine’s name. Enter information confirmed from the product documentation and business policy. A restricted checkbox is not authorization or regulatory compliance.

**Keep purchase details out &#x20;**&#x4D;ay-2026 and Jun-2026 can still have different cost, selling price, expiry and remaining stock. Those are later purchase/stock records, not fields to add to this form.

Basis: [C1] Week 5 Day 1; [C3] seven-field schema and mapper; [C4] existing product columns. The storage flags are a proposed implementation choice.



**DAY 1 • DATABASE AND VALIDATION**

# **Add a small, explicit extension**

Use this SQL only after confirming that the five columns below are absent. Put it in a new migration, not in the already-applied initial catalogue file. A field already present needs wiring, not a duplicate ADD COLUMN.

\-- Add in the next UNUSED migration version.\
 -- Do not add these again if your local schema has them.\
 ALTER TABLE products ADD COLUMN manufacturer TEXT;\
 ALTER TABLE products ADD COLUMN storage_instructions TEXT;\
 ALTER TABLE products ADD COLUMN is_restricted\
   INTEGER NOT NULL DEFAULT 0 CHECK (is_restricted IN (0,1));\
 ALTER TABLE products ADD COLUMN requires_cold_storage\
   INTEGER NOT NULL DEFAULT 0\
   CHECK (requires_cold_storage IN (0,1));\
 ALTER TABLE products ADD COLUMN requires_secure_storage\
   INTEGER NOT NULL DEFAULT 0\
   CHECK (requires_secure_storage IN (0,1));

A SQL flag is stored as 0 or 1 in this proposal. In TypeScript, expose it as boolean: isRestricted: row\.is_restricted === 1. For a write, bind input.isRestricted ? 1 : 0. Blank optional text can be normalized to NULL.

## **Suggested form limits—not inherited database rules**

| **Field**                          | **Proposed validation**                        |
| ---------------------------------- | ---------------------------------------------- |
| Category                           | Trim; require 1–80 characters.                 |
| Manufacturer                       | Optional; maximum 120 characters.              |
| Description / storage instructions | Optional; maximum 1,000 characters each.       |
| Expiry tracking                    | Accept only NONE, OPTIONAL or REQUIRED.        |
| Flags                              | Accept booleans; database accepts only 0 or 1. |



Add limits to Zod and repository normalization. Existing product names and SKUs keep their current rules unless you explicitly choose stricter limits and review old data first. A new UI limit does not alter the database constraint by itself.

**Why two storage flags? &#x20;**&#x41;n item can require both cold and secure storage. Do not force that combination into a single mutually exclusive dropdown. Keep the verified free-text instruction alongside the simplified flags.



**DAY 1 • IMPLEMENT AND PROVE**

# **Wire every new field through the full round trip**

**1. Extend the schema and form defaults.&#x20;**&#x49;n product.schema.ts add the new fields. Use empty strings for optional text inputs, false for flags, and an explicit expiry-tracking default. Add visible labels in ProductForm.tsx.

**2. Extend the repository contract.&#x20;**&#x55;pdate ProductInput, ProductDto and ProductRow in productRepository.core.ts. Add database columns to its fixed SELECT column list. ProductRecord derives from the form values, so check those types together.

**3. Update mapping in both directions.&#x20;**&#x46;or reads, map manufacturer, category, description, expiry_tracking and the new flags to their TypeScript properties. For writes, include each field in the parameterized INSERT and UPDATE. Add matching values in the same order.

**4. Preserve the identity and status.&#x20;**&#x41;n edit must target the same ID. Do not reset INACTIVE to ACTIVE while saving descriptive fields. Keep fields you are not editing unchanged.

**5. Reuse your feedback pattern.&#x20;**&#x41;wait the repository result; close the modal only on success. A failed save keeps all typing. Keep Cancel visible and retain the existing focus/close policy.

## **Example mapping additions**

// Add to your existing row-to-product mapper:\
 category: row\.category,\
 manufacturer: row\.manufacturer ?? "",\
 description: row\.description ?? "",\
 expiryTracking: row\.expiry_tracking,\
 storageInstructions: row\.storage_instructions ?? "",\
 isRestricted: row\.is_restricted === 1,\
 requiresColdStorage: row\.requires_cold_storage === 1,\
 requiresSecureStorage: row\.requires_secure_storage === 1,

## **Day 1 is finished when…**

Create or edit both sample products, save, close the entire desktop app and reopen. The new values must remain. Confirm an edit does not change the ID or status. A non-medicine product must not require strength or dosage form. A duplicate SKU must still show the existing field error.

Deliverable: one extended Product Form and repository, one new migration if needed, and a short list of actual test outcomes. Do not create a second product system.