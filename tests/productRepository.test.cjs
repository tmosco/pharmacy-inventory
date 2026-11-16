const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  makeProductRepository,
  RepositoryError,
} = require('../build/data/repositories/productRepository.core.js');

const form = Object.freeze({
  sku: ' PARA-500 ', genericName: ' Paracetamol 500mg ', brandName: '',
  strength: '500mg', dosageForm: 'Tablet', baseUnit: 'TABLET', reorderLevel: 20,
});
function makeHarness() {
  const rows = [];
  const unitRows = [];
  const calls = [];
  const db = {
    async select(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes('FROM product_units u')) {
        return unitRows.filter(u => u.barcode === values[0]).map(u => ({
          ...rows.find(r => r.id === u.product_id),
          unit_id: u.id, unit_name: u.name, quantity_in_base_units: u.quantity_in_base_units,
        }));
      }
      if (sql.includes('WHERE p.id = $1')) return rows.filter(r => r.id === values[0]);
      return rows.slice().sort((a,b)=>a.name.localeCompare(b.name));
    },
    async execute(sql, values = []) {
      calls.push({sql, values});
      if (sql.startsWith('INSERT INTO products')) {
        if (rows.some(r => r.sku.toLowerCase() === String(values[1]).toLowerCase())) {
          throw Error('UNIQUE constraint failed: products.sku');
        }
        rows.push({id:values[0],sku:values[1],name:values[2],brand_name:values[3],
          strength:values[4],dosage_form:values[5],base_unit:values[6],
          reorder_level:values[7],status:'ACTIVE'});
        return {rowsAffected:1};
      }
      if (sql.includes("SET status='INACTIVE'")) {
        const row = rows.find(r=>r.id===values[0]);
        if (!row) return {rowsAffected:0};
        row.status='INACTIVE'; return {rowsAffected:1};
      }
      if (sql.startsWith('UPDATE products SET')) {
        const row = rows.find(r=>r.id===values[7]);
        if (!row) return {rowsAffected:0};
        Object.assign(row,{sku:values[0],name:values[1],brand_name:values[2],strength:values[3],
          dosage_form:values[4],base_unit:values[5],reorder_level:values[6]});
        return {rowsAffected:1};
      }
      throw Error('Fake driver does not recognize SQL');
    },
  };
  let index=0;
  const repo = makeProductRepository(async()=>db,()=>`p-${++index}`);
  return {repo,rows,unitRows,calls};
}

test('list starts empty and create returns an ACTIVE product with trimmed values',async()=>{
  const h=makeHarness();
  assert.deepEqual(await h.repo.list(),[]);
  const product=await h.repo.create(form);
  assert.equal(product.id,'p-1');
  assert.equal(product.sku,'PARA-500');
  assert.equal(product.genericName,'Paracetamol 500mg');
  assert.equal(product.status,'ACTIVE');
  assert.equal((await h.repo.list()).length,1);
});

test('findById maps SQL name and nullable brand into React values',async()=>{
  const h=makeHarness();
  await h.repo.create(form);
  const product=await h.repo.findById('p-1');
  assert.equal(product.genericName,'Paracetamol 500mg');
  assert.equal(product.brandName,'');
  assert.equal(await h.repo.findById('unknown'),null);
});

test('findById uses a bound $1 parameter, even for quote-containing input',async()=>{
  const h=makeHarness();
  await h.repo.findById("p-1' OR 1=1 --");
  const call=h.calls.at(-1);
  assert.ok(call.sql.includes('WHERE p.id = $1'));
  assert.deepEqual(call.values,["p-1' OR 1=1 --"]);
});

test('findByBarcode preserves conversion of matching packaging unit',async()=>{
  const h=makeHarness();
  await h.repo.create(form);
  h.unitRows.push({id:'box-1',product_id:'p-1',name:'Box',barcode:'001234',quantity_in_base_units:100});
  const result=await h.repo.findByBarcode(' 001234 ');
  assert.equal(result.product.id,'p-1');
  assert.equal(result.unitName,'Box');
  assert.equal(result.quantityInBaseUnits,100);
  assert.equal(await h.repo.findByBarcode(''),null);
});

test('create rejects a negative reorder level before calling SQL',async()=>{
  const h=makeHarness();
  await assert.rejects(h.repo.create({...form,reorderLevel:-5}),e=>e instanceof RepositoryError && e.code==='INVALID_INPUT');
  assert.equal(h.calls.length,0);
});

test('create maps a duplicate SKU error to a user-friendly field error',async()=>{
  const h=makeHarness();
  await h.repo.create(form);
  await assert.rejects(h.repo.create({...form,sku:'para-500'}),e=>e.code==='DUPLICATE_SKU' && e.field==='sku');
});

test('update changes editable fields without altering status',async()=>{
  const h=makeHarness();
  await h.repo.create(form);
  await h.repo.deactivate('p-1');
  await h.repo.update('p-1',{...form,genericName:'Pain Relief'});
  const product=await h.repo.findById('p-1');
  assert.equal(product.genericName,'Pain Relief');
  assert.equal(product.status,'INACTIVE');
});

test('deactivate keeps the product record and updates its status',async()=>{
  const h=makeHarness();
  await h.repo.create(form);
  await h.repo.deactivate('p-1');
  assert.equal((await h.repo.list()).length,1);
  assert.equal((await h.repo.findById('p-1')).status,'INACTIVE');
});

test('missing update and deactivate return NOT_FOUND',async()=>{
  const h=makeHarness();
  await assert.rejects(h.repo.update('missing',form),e=>e.code==='NOT_FOUND');
  await assert.rejects(h.repo.deactivate('missing'),e=>e.code==='NOT_FOUND');
});
