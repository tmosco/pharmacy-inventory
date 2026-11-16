-- Migration 001: Initial catalog schema for a general-purpose inventory application.
-- Use this file ONLY if migration 001 has never been applied to your database.
-- Product identity belongs to products; purchase costs, expiry, and on-hand
-- quantities belong to later purchase-batch/stock tables.
-- Assumption: this initial SQLite database belongs to ONE business.
-- Note: foreign-key enforcement must be enabled on each database connection.

CREATE TABLE IF NOT EXISTS branches (
    id         TEXT PRIMARY KEY NOT NULL,
    code       TEXT NOT NULL COLLATE NOCASE UNIQUE
               CHECK (length(trim(code)) > 0),
    name       TEXT NOT NULL CHECK (length(trim(name)) > 0),
    street     TEXT,
    city       TEXT,
    region     TEXT,
    country    TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- The PRODUCTS table, aligned with your Week 3 Product Form.
-- React genericName is saved as SQL name (not generic_name) to support any inventory.
CREATE TABLE IF NOT EXISTS products (
    id                 TEXT PRIMARY KEY NOT NULL,
    sku                TEXT NOT NULL COLLATE NOCASE UNIQUE
                       CHECK (length(trim(sku)) > 0),
    name               TEXT NOT NULL CHECK (length(trim(name)) > 0),
    brand_name         TEXT,
    strength           TEXT, -- optional industry-specific description (e.g. 500mg)
    dosage_form        TEXT, -- optional, only useful for medicines
    category           TEXT NOT NULL DEFAULT 'Uncategorized'
                       CHECK (length(trim(category)) > 0),
    base_unit          TEXT NOT NULL CHECK (length(trim(base_unit)) > 0),
    quantity_precision INTEGER NOT NULL DEFAULT 0
                       CHECK (typeof(quantity_precision) = 'integer'
                              AND quantity_precision BETWEEN 0 AND 3),
    reorder_level      INTEGER NOT NULL DEFAULT 0
                       CHECK (typeof(reorder_level) = 'integer'
                              AND reorder_level >= 0),
    status             TEXT NOT NULL DEFAULT 'ACTIVE'
                       CHECK (status IN ('ACTIVE', 'INACTIVE', 'DISCONTINUED')),
    expiry_tracking    TEXT NOT NULL DEFAULT 'OPTIONAL'
                       CHECK (expiry_tracking IN ('NONE', 'OPTIONAL', 'REQUIRED')),
    description        TEXT,
    created_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Packaging descriptions and barcodes belong to PRODUCT UNITS, not products
-- or shelf locations. Multiple NULL barcodes are permitted.
CREATE TABLE IF NOT EXISTS product_units (
    id                     TEXT PRIMARY KEY NOT NULL,
    product_id             TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    name                   TEXT NOT NULL COLLATE NOCASE
                           CHECK (length(trim(name)) > 0),
    quantity_in_base_units REAL NOT NULL
                           CHECK (quantity_in_base_units > 0),
    barcode                TEXT UNIQUE
                           CHECK (barcode IS NULL OR length(trim(barcode)) > 0),
    pack_description       TEXT,
    UNIQUE (product_id, name)
);

-- Locations allow Analgesics -> Top / Middle / Bottom, but also
-- Warehouse -> Aisle -> Rack -> Bin for another kind of inventory.
CREATE TABLE IF NOT EXISTS locations (
    id                 TEXT PRIMARY KEY NOT NULL,
    branch_id          TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    parent_location_id TEXT,
    code               TEXT NOT NULL COLLATE NOCASE
                       CHECK (length(trim(code)) > 0),
    name               TEXT NOT NULL CHECK (length(trim(name)) > 0),
    type               TEXT NOT NULL
                       CHECK (type IN ('ROOM','AISLE','SHELF','SECTION','BIN','OTHER')),
    position           TEXT CHECK (position IS NULL OR position IN ('TOP','MIDDLE','BOTTOM')),
    sort_order         INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    UNIQUE (branch_id, code),
    UNIQUE (id, branch_id),
    CHECK (parent_location_id IS NULL OR parent_location_id <> id),
    CHECK (position IS NULL OR type = 'SECTION'),
    FOREIGN KEY (parent_location_id, branch_id)
        REFERENCES locations(id, branch_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_products_status_name
    ON products(status, name);
CREATE INDEX IF NOT EXISTS idx_product_units_product
    ON product_units(product_id);
CREATE INDEX IF NOT EXISTS idx_locations_branch_parent
    ON locations(branch_id, parent_location_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_location_section_position
    ON locations(parent_location_id, position)
    WHERE position IS NOT NULL;
