const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const { mkdtempSync, rmSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const { makeBranchRepository } = require('./build/data/repositories/branchRepository.core.js');
const { makeLocationRepository } = require('./build/data/repositories/locationRepository.core.js');
const { makeProductUnitRepository, assertProductUnitAllowed } = require('./build/data/repositories/productUnitRepository.core.js');
const { toBaseUnits } = require('./build/features/products/utils/unitConversion.js');
const SQL = readFileSync(join(__dirname,'fixtures/001_initial_catalog_REFERENCE_ONLY.sql'),'utf8');
const UNIT_SQL = readFileSync(join(__dirname,'../src-tauri/migrations/002_product_unit_eligibility.sql'),'utf8');

function fixture() {
  const directory = mkdtempSync(join(tmpdir(),'inventory-week5-'));
  const file = join(directory,'test.db');
  const sqlite = new DatabaseSync(file);
  sqlite.exec('PRAGMA foreign_keys=ON;');
  sqlite.exec(SQL);
  sqlite.exec(UNIT_SQL);
  const bindings = (xs = []) => Object.fromEntries(xs.map((x,i)=> [`$${i+1}`,x]));
  const provider = async () => ({
    async select(sql, values = []) { return sqlite.prepare(sql).all(bindings(values)); },
    async execute(sql, values = []) {
      const res = sqlite.prepare(sql).run(bindings(values));
      return {rowsAffected:Number(res.changes)};
    },
  });
  const branches=makeBranchRepository(provider,randomUUID);
  const locations=makeLocationRepository(provider,randomUUID);
  const units=makeProductUnitRepository(provider,randomUUID);
  const close=()=>{sqlite.close();rmSync(directory,{recursive:true,force:true});};
  return {sqlite,file,branches,locations,units,close};
}
const branchA = {code:'MAIN',name:'Lagos Main',city:'Ikeja',country:'Nigeria'};
const branchB = {code:'SECOND',name:'Other Branch',city:'Abuja',country:'Nigeria'};
function loc(branchId, name, code, type, parentLocationId=null, position=null) {
  return {branchId,name,code,type,parentLocationId,position,sortOrder:0};
}
function sampleUnit(productId, name='Box', quantityInBaseUnits=100, barcode='000123') {
  return {productId,name,quantityInBaseUnits,barcode,packDescription:'10 x 10'};
}
function product(sqlite,precision=0){
  const id=randomUUID();
  sqlite.prepare('INSERT INTO products(id,sku,name,base_unit,quantity_precision) VALUES(?,?,?,?,?)')
    .run(id,`SKU-${id}`, 'Paracetamol 500mg','TABLET',precision);
  return id;
}

// Each test opens its own disposable real file; none touches the user's pharmacy.db.
test('branch CRUD and mapping', async()=>{
  const f=fixture();try{
    const a=await f.branches.create(branchA);
    assert.equal((await f.branches.list()).length,1);
    assert.equal((await f.branches.findByCode('main')).id,a.id);
    assert.equal((await f.branches.findById(a.id)).city,'Ikeja');
    const changed=await f.branches.update(a.id,{...branchA,name:'Lagos Central'});
    assert.equal(changed.id,a.id);
    assert.equal((await f.branches.findById(a.id)).name,'Lagos Central');
  }finally{f.close();}
});
test('branch code uniqueness is enforced by SQLite', async()=>{
  const f=fixture();try{
    await f.branches.create(branchA);
    await assert.rejects(f.branches.create({...branchB,code:'main'}),{code:'DUPLICATE_BRANCH_CODE'});
    assert.equal((await f.branches.list()).length,1);
  }finally{f.close();}
});
test('branch requires a meaningful name', async()=>{
 const f=fixture();try{await assert.rejects(f.branches.create({...branchA,name:'   '}),{code:'INVALID_INPUT'});}finally{f.close();}
});
test('location hierarchy supports shelf with three unique sections', async()=>{
 const f=fixture();try{
   const b=await f.branches.create(branchA);
   const shelf=await f.locations.create(loc(b.id,'Analgesics','A-01','SHELF'));
   for(const p of ['TOP','MIDDLE','BOTTOM']) {
     const s=await f.locations.create(loc(b.id,p,`A-01-${p}`,'SECTION',shelf.id,p));
     assert.ok(s.id);
   }
   assert.equal((await f.locations.listByBranch(b.id)).length,4);
   assert.equal(await f.locations.getDisplayPath(shelf.id),'Lagos Main → Analgesics');
   const top=await f.locations.findByCode(b.id,'a-01-top');
   assert.equal(await f.locations.getDisplayPath(top.id),'Lagos Main → Analgesics → TOP');
 }finally{f.close();}
});
test('duplicate shelf position is rejected', async()=>{
 const f=fixture();try{
   const b=await f.branches.create(branchA);
   const shelf=await f.locations.create(loc(b.id,'Analgesics','A-01','SHELF'));
   await f.locations.create(loc(b.id,'Top','TOP-1','SECTION',shelf.id,'TOP'));
   await assert.rejects(f.locations.create(loc(b.id,'Other Top','TOP-2','SECTION',shelf.id,'TOP')),{code:'DUPLICATE_SHELF_POSITION'});
 }finally{f.close();}
});
test('case-insensitive location code uniqueness is branch-specific',async()=>{
 const f=fixture();try{
   const a=await f.branches.create(branchA), b=await f.branches.create(branchB);
   await f.locations.create(loc(a.id,'Shelf','S-01','SHELF'));
   await assert.rejects(f.locations.create(loc(a.id,'Copy','s-01','SHELF')),{code:'DUPLICATE_LOCATION_CODE'});
   assert.ok((await f.locations.create(loc(b.id,'Other','S-01','SHELF'))).id);
 }finally{f.close();}
});
test('cross-branch location parenting is blocked',async()=>{
 const f=fixture();try{
   const a=await f.branches.create(branchA),b=await f.branches.create(branchB);
   const shelf=await f.locations.create(loc(a.id,'Shelf','S-1','SHELF'));
   await assert.rejects(f.locations.create(loc(b.id,'Top','T-1','SECTION',shelf.id,'TOP')),{code:'INVALID_PARENT'});
 }finally{f.close();}
});
test('location cannot be its own parent or become a descendant of itself',async()=>{
 const f=fixture();try{
   const b=await f.branches.create(branchA);
   const room=await f.locations.create(loc(b.id,'Room','R-1','ROOM'));
   const shelf=await f.locations.create(loc(b.id,'Shelf','S-1','SHELF',room.id));
   await assert.rejects(f.locations.update(room.id,loc(b.id,'Room','R-1','ROOM',shelf.id)),{code:'LOCATION_CYCLE'});
   await assert.rejects(f.locations.update(room.id,loc(b.id,'Room','R-1','ROOM',room.id)),{code:'LOCATION_CYCLE'});
   assert.equal((await f.locations.findById(room.id)).parentLocationId,null);
 }finally{f.close();}
});
test('non-shelf cannot own a TOP position',async()=>{
 const f=fixture();try{
   const b=await f.branches.create(branchA);
   const room=await f.locations.create(loc(b.id,'Room','R-1','ROOM'));
   await assert.rejects(f.locations.create(loc(b.id,'Top','T-1','SECTION',room.id,'TOP')),{code:'INVALID_PARENT'});
 }finally{f.close();}
});
test('location update changes one record and preserves branch', async()=>{
 const f=fixture();try{
   const b=await f.branches.create(branchA);
   const shelf=await f.locations.create(loc(b.id,'Analgesics','A-01','SHELF'));
   const changed=await f.locations.update(shelf.id,{...loc(b.id,'Pain Relief','A-01','SHELF'),sortOrder:4});
   assert.equal(changed.name,'Pain Relief');assert.equal(changed.branchId,b.id);
   assert.equal(await f.locations.getDisplayPath(shelf.id),'Lagos Main → Pain Relief');
 }finally{f.close();}
});
test('package units create/read/update with barcode leading zeros',async()=>{
 const f=fixture();try{
   const p=product(f.sqlite);
   const id=await f.units.create(sampleUnit(p));
   const row=await f.units.findByBarcode('000123');
   assert.equal(row.id,id);assert.equal(row.quantityInBaseUnits,100);
   assert.equal((await f.units.listForProduct(p)).length,1);
   const updated=await f.units.update(p,id,{name:'Carton',quantityInBaseUnits:200,barcode:'000999',packDescription:'Two boxes'});
   assert.equal(updated.id,id);assert.equal(updated.quantityInBaseUnits,200);
   assert.equal((await f.units.findByBarcode('000999')).id,id);
 }finally{f.close();}
});
test('duplicate barcode and duplicate name are rejected',async()=>{
 const f=fixture();try{
   const p=product(f.sqlite);
   await f.units.create(sampleUnit(p));
   await assert.rejects(f.units.create(sampleUnit(p,'Pack',10,'000123')),{code:'DUPLICATE_BARCODE'});
   await assert.rejects(f.units.create(sampleUnit(p,'box',10,'999')),{code:'DUPLICATE_UNIT_NAME'});
 }finally{f.close();}
});
test('whole-unit products reject fractional conversion',async()=>{
 const f=fixture();try{
   const p=product(f.sqlite);
   await assert.rejects(f.units.create(sampleUnit(p,'Half',0.5,'')),{code:'INVALID_INPUT'});
 }finally{f.close();}
});
test('even decimal precision products require whole package conversions',async()=>{
 const f=fixture();try{
   const p=product(f.sqlite,3);
   await assert.rejects(f.units.create(sampleUnit(p,'Bag',1.125,'')),{code:'INVALID_INPUT'});
 }finally{f.close();}
});
test('units show whole base conversion, eligibility flags, and persist through deactivate',async()=>{
 const f=fixture();try{
   const p=product(f.sqlite);
   const tablet=await f.units.create({...sampleUnit(p,'Tablet',1,'001'),canPurchase:true,canSell:true});
   const strip=await f.units.create({...sampleUnit(p,'Strip',10,'002'),canPurchase:true,canSell:true});
   const box=await f.units.create({...sampleUnit(p,'Box',100,'003'),canPurchase:true,canSell:true});
   await f.units.create({...sampleUnit(p,'Carton',1000,'004'),canPurchase:true,canSell:false});
   assert.equal((await f.units.listByProduct(p)).length,4);
   assert.equal((await f.units.findByBarcode('004')).canSell,false);
   const inactive=await f.units.deactivate(p,box);
   assert.equal(inactive.isActive,false);
   assert.equal((await f.units.listByProduct(p)).length,4);
   assert.equal((await f.units.findByBarcode('003')).id,box);
   await assert.rejects(f.units.create(sampleUnit(p,'Another box',100,'003')),{code:'DUPLICATE_BARCODE'});
   await assert.rejects(Promise.resolve().then(()=>assertProductUnitAllowed(inactive,'SALE')),{code:'INACTIVE_UNIT'});
   const cannotSell=await f.units.findById((await f.units.findByBarcode('004')).id);
   await assert.rejects(Promise.resolve().then(()=>assertProductUnitAllowed(cannotSell,'SALE')),{code:'UNIT_OPERATION_NOT_ALLOWED'});
   const reopened=new DatabaseSync(f.file);
   try { assert.equal(reopened.prepare('SELECT is_active FROM product_units WHERE id=?').get(box).is_active,0); }
   finally { reopened.close(); }
   assert.ok(tablet && strip && box);
 }finally{f.close();}
});
test('conversion preview sums package quantities without touching stock',()=>{
 assert.equal(toBaseUnits(2,100)+toBaseUnits(3,10)+toBaseUnits(4,1),234);
 for (const [quantity,factor] of [[0,1],[-1,1],[1,0],[1,-2],[2.5,10],[1,2.5],[NaN,1],[Infinity,1]]) {
   assert.throws(()=>toBaseUnits(quantity,factor));
 }
 assert.throws(()=>toBaseUnits(Number.MAX_SAFE_INTEGER,2),/too large/);
});
test('missing product for packaging is rejected',async()=>{
 const f=fixture();try{
   await assert.rejects(f.units.create(sampleUnit('missing')),{code:'NOT_FOUND'});
 }finally{f.close();}
});
test('physical database file persists after close/reopen', async()=>{
 const f=fixture();
 const a=await f.branches.create(branchA);
 const name=f.file;
 // Close the original handle, read the file from a different SQLite handle.
 f.sqlite.close();
 const reopened=new DatabaseSync(name);
 try {
   assert.equal(reopened.prepare('SELECT name FROM branches WHERE id=?').get(a.id).name,'Lagos Main');
 } finally {
   reopened.close();
   rmSync(require('node:path').dirname(name),{recursive:true,force:true});
 }
});
