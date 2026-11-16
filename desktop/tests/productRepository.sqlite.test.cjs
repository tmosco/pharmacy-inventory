'use strict';

/**
 * Day 6: real SQLite repository tests, isolated from the user's app database.
 * Prerequisite: Node >= 22 with node:sqlite and compiled core in tests/.compiled.
 * Never import this file into Vite/React; Node development tests only.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync, backup } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { makeProductRepository } = require('./.compiled/data/repositories/productRepository.core.js');
const migrationDir = path.resolve(__dirname, '../src-tauri/migrations');
const firstMigration = path.join(migrationDir, '001_initial_catalog.sql');

if (!fs.existsSync(firstMigration)) {
  throw new Error(`Migration not found: ${firstMigration}. Copy tests into your desktop/ project.`);
}
const migration001 = fs.readFileSync(firstMigration, 'utf8');

function findMigration002() {
  if (!fs.existsSync(migrationDir)) return null;
  const matches = fs.readdirSync(migrationDir)
    .filter(file => /^002_.*\.sql$/i.test(file));
  if (matches.length > 1) {
    throw new Error(`More than one migration 002 found: ${matches.join(', ')}. Choose the applied migration explicitly.`);
  }
  return matches[0] ? fs.readFileSync(path.join(migrationDir, matches[0]), 'utf8') : null;
}
const migration002 = findMigration002();

function hasFormColumns(sqlite) {
  const columns = new Set(sqlite.prepare('PRAGMA table_info(products)').all().map(row => row.name));
  return ['strength','dosage_form','reorder_level'].every(c => columns.has(c));
}

function applySchema(sqlite) {
  sqlite.exec(migration001);
  if (!hasFormColumns(sqlite)) {
    if (!migration002) {
      throw new Error('Migration 001 lacks form columns and 002_*.sql was not found. Do not rewrite an applied 001.');
    }
    // Run the upgrade atomically in the test, like a proper migration runner.
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      sqlite.exec(migration002);
      sqlite.exec('COMMIT');
    } catch (e) {
      sqlite.exec('ROLLBACK');
      throw e;
    }
  }
  if (!hasFormColumns(sqlite)) {
    throw new Error('Schema is missing product form fields after applying migrations');
  }
}

// The repository passes $1, $2, ... placeholders. Node SQLite expects
// named bound parameters, not string concatenation.
function bind(values) {
  return Object.fromEntries(values.map((value, i) => [`$${i+1}`, value]));
}

function connectRepository(sqlite) {
  const client = {
    async select(sql, values = []) {
      return sqlite.prepare(sql).all(bind(values));
    },
    async execute(sql, values = []) {
      const result = sqlite.prepare(sql).run(bind(values));
      return { rowsAffected: Number(result.changes) };
    },
  };
  return makeProductRepository(async () => client, randomUUID);
}

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-day6-'));
  const file = path.join(directory, 'test.db');
  const sqlite = new DatabaseSync(file);
  sqlite.exec('PRAGMA foreign_keys = ON');
  applySchema(sqlite);
  let closed = false;
  t.after(() => {
    if (!closed) sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return {
    sqlite,
    file,
    directory,
    repo: connectRepository(sqlite),
    close: () => { if (!closed) { sqlite.close(); closed = true; } },
  };
}

const product = Object.freeze({
  sku: ' PARA-500 ',
  genericName: ' Paracetamol 500mg ',
  brandName: '',
  strength: '500mg',
  dosageForm: 'Tablet',
  baseUnit: 'TABLET',
  reorderLevel: 20,
});

// Each test begins with its own temp SQLite file and schema.
test('migration creates the four catalog tables and expected product columns', t => {
  const { sqlite } = fixture(t);
  const tables = new Set(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name));
  for (const table of ['branches','products','product_units','locations']) {
    assert.ok(tables.has(table), `${table} missing`);
  }
  assert.ok(hasFormColumns(sqlite));
});

test('creates a product and maps the saved row', async t => {
  const { repo } = fixture(t);
  const saved = await repo.create(product);
  assert.equal(saved.status, 'ACTIVE');
  assert.equal(saved.sku, 'PARA-500');
  assert.equal(saved.genericName, 'Paracetamol 500mg');
  assert.deepEqual(await repo.findById(saved.id), saved);
});

test('case-insensitive duplicate SKU is rejected by REAL SQLite', async t => {
  const { repo } = fixture(t);
  await repo.create(product);
  await assert.rejects(repo.create({ ...product, sku: 'para-500' }), { code: 'DUPLICATE_SKU' });
  assert.equal((await repo.list()).length, 1);
});

test('invalid product values fail SQL constraints independent of React', t => {
  const { sqlite } = fixture(t);
  const insert = sqlite.prepare(
    'INSERT INTO products(id, sku, name, base_unit, reorder_level, status) VALUES(?, ?, ?, ?, ?, ?)'
  );
  assert.throws(() => insert.run('id-neg','NEG','Negative','PIECE',-1,'ACTIVE'), /CHECK constraint failed/i);
  assert.throws(() => insert.run('id-status','ST','Status','PIECE',0,'EXPIRED'), /CHECK constraint failed/i);
  assert.throws(() => insert.run('id-name','NM','   ','PIECE',0,'ACTIVE'), /CHECK constraint failed/i);
});

test('findByBarcode returns a packaging conversion and retains leading zeroes', async t => {
  const { sqlite, repo } = fixture(t);
  const saved = await repo.create(product);
  sqlite.prepare(`INSERT INTO product_units
    (id,product_id,name,quantity_in_base_units,barcode,pack_description)
    VALUES (?,?,?,?,?,?)`)
    .run('unit-box',saved.id,'Box',100,'0012345678901','100 tablets');
  const matched = await repo.findByBarcode(' 0012345678901 ');
  assert.equal(matched.product.id, saved.id);
  assert.equal(matched.unitName, 'Box');
  assert.equal(matched.quantityInBaseUnits,100);
  assert.equal(await repo.findByBarcode(''), null);
});

test('database rejects duplicate non-null barcodes', async t => {
  const { sqlite, repo } = fixture(t);
  const saved = await repo.create(product);
  const insert = sqlite.prepare(`INSERT INTO product_units
    (id,product_id,name,quantity_in_base_units,barcode) VALUES(?,?,?,?,?)`);
  insert.run('u1',saved.id,'Box',100,'000987');
  assert.throws(() => insert.run('u2',saved.id,'Pack',10,'000987'), /UNIQUE constraint failed/i);
});

test('foreign keys reject packaging pointing to a nonexistent product', t => {
  const { sqlite } = fixture(t);
  assert.equal(sqlite.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  assert.throws(() => sqlite.prepare(
    `INSERT INTO product_units(id, product_id, name, quantity_in_base_units) VALUES('missing-unit','no-product','Box',10)`
  ).run(), /FOREIGN KEY constraint failed/i);
});

test('an SQL-looking product name is stored as data, not executed', async t => {
  const { repo, sqlite } = fixture(t);
  const attackLookingName = "O'Brien'); DROP TABLE products; --";
  const saved = await repo.create({ ...product, genericName: attackLookingName });
  assert.equal((await repo.findById(saved.id)).genericName, attackLookingName);
  assert.equal(sqlite.prepare("SELECT count(*) as n FROM sqlite_master WHERE name='products'").get().n,1);
});

test('editing and deactivation preserve ID and record', async t => {
  const { repo } = fixture(t);
  const saved = await repo.create(product);
  await repo.update(saved.id, { ...product, genericName: 'Updated name' });
  await repo.deactivate(saved.id);
  const updated = await repo.findById(saved.id);
  assert.equal(updated.id,saved.id);
  assert.equal(updated.genericName,'Updated name');
  assert.equal(updated.status,'INACTIVE');
  assert.equal((await repo.list()).length, 1);
});

test('missing product ID produces NOT_FOUND, not false success', async t => {
  const { repo } = fixture(t);
  await assert.rejects(repo.update('not-here',product), { code:'NOT_FOUND' });
  await assert.rejects(repo.deactivate('not-here'), { code:'NOT_FOUND' });
});

test('product data survives closing and reopening a temporary database', async t => {
  const { repo, sqlite, file, close } = fixture(t);
  const saved = await repo.create(product);
  await repo.deactivate(saved.id);
  close();
  const opened = new DatabaseSync(file);
  t.after(() => opened.close());
  const row = opened.prepare('SELECT id,sku,name,status FROM products WHERE id=?').get(saved.id);
  assert.equal(row.id,saved.id);
  assert.equal(row.status,'INACTIVE');
  assert.equal(row.name,'Paracetamol 500mg');
});

test('SQLite backup API creates a restorable consistent snapshot', async t => {
  const { sqlite, directory, repo } = fixture(t);
  const saved = await repo.create(product);
  await repo.deactivate(saved.id);
  const target = path.join(directory, 'restore-test.db');
  await backup(sqlite,target);
  const copy = new DatabaseSync(target);
  t.after(() => copy.close());
  assert.equal(copy.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  assert.equal(copy.prepare('PRAGMA foreign_key_check').all().length, 0);
  const row = copy.prepare('SELECT id, sku, name, status FROM products WHERE id=?').get(saved.id);
  assert.equal(row.id,saved.id);
  assert.equal(row.status,'INACTIVE');
});

test('re-running 001 SQL does not delete existing product records', async t => {
  const { sqlite, repo } = fixture(t);
  const saved = await repo.create(product);
  sqlite.exec(migration001);
  const row = await repo.findById(saved.id);
  assert.equal(row.id, saved.id);
  assert.equal(row.sku, 'PARA-500');
});

test('schema has no foreign-key violations', t => {
  const { sqlite } = fixture(t);
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  assert.equal(sqlite.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
});

test('optional migration 002 preserves an older product during upgrade', t => {
  if (!migration002) {
    t.skip('No migration 002 in this project; current migration 001 may already contain form fields.');
    return;
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-upgrade-'));
  t.after(() => fs.rmSync(directory,{recursive:true,force:true}));
  const db = new DatabaseSync(path.join(directory,'upgrade.db'));
  t.after(() => db.close());
  db.exec(`CREATE TABLE products (
    id TEXT PRIMARY KEY NOT NULL, sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL, brand_name TEXT, base_unit TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE');
    CREATE TABLE product_units (
    id TEXT PRIMARY KEY NOT NULL, product_id TEXT NOT NULL REFERENCES products(id),
    name TEXT NOT NULL, quantity_in_base_units REAL NOT NULL,
    barcode TEXT, pack_description TEXT);
    INSERT INTO products(id,sku,name,base_unit,status)
    VALUES ('before-002','OLD-1','Old product','PIECE','ACTIVE');`);
  db.exec('BEGIN IMMEDIATE');
  try { db.exec(migration002); db.exec('COMMIT'); }
  catch (err) { db.exec('ROLLBACK'); throw err; }
  assert.ok(hasFormColumns(db));
  const old = db.prepare('SELECT id,name,reorder_level FROM products WHERE id=?').get('before-002');
  assert.equal(old.name,'Old product');
  assert.equal(old.reorder_level,0);
});
