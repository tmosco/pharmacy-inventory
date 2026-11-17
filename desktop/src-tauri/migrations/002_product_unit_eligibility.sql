-- Week 5 Day 2: package status and transaction eligibility.
-- Keep existing units usable by default. Do not rewrite package factors here;
-- legacy fractional factors must be reviewed explicitly before correction.
ALTER TABLE product_units ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1
  CHECK (is_active IN (0, 1));
ALTER TABLE product_units ADD COLUMN can_purchase INTEGER NOT NULL DEFAULT 1
  CHECK (can_purchase IN (0, 1));
ALTER TABLE product_units ADD COLUMN can_sell INTEGER NOT NULL DEFAULT 1
  CHECK (can_sell IN (0, 1));

-- New or changed factors must be positive whole numbers. Existing fractional
-- rows remain readable until an operator reviews and corrects them.
CREATE TRIGGER product_units_integer_factor_insert
BEFORE INSERT ON product_units
WHEN NEW.quantity_in_base_units <= 0
  OR NEW.quantity_in_base_units != CAST(NEW.quantity_in_base_units AS INTEGER)
BEGIN
  SELECT RAISE(ABORT, 'product_units quantity_in_base_units must be a positive whole number');
END;

CREATE TRIGGER product_units_integer_factor_update
BEFORE UPDATE OF quantity_in_base_units ON product_units
WHEN NEW.quantity_in_base_units <= 0
  OR NEW.quantity_in_base_units != CAST(NEW.quantity_in_base_units AS INTEGER)
BEGIN
  SELECT RAISE(ABORT, 'product_units quantity_in_base_units must be a positive whole number');
END;
