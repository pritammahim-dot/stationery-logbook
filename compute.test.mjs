/*
 * compute.test.mjs — headless unit tests for compute.js (no Google needed).
 * Run:  node compute.test.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const C = require('./compute.js');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  ok   - ' + name); }
  else { fail++; console.error('  FAIL - ' + name); process.exitCode = 1; }
}

// ---- fixture (worked example) ----
const items = [
  { item_id: 'ITM-0001', name_en: 'A4 Paper', unit: 'ream',  opening_balance: 10, reorder_level: 8,  active: 'TRUE' },
  { item_id: 'ITM-0002', name_en: 'Pen',      unit: 'piece', opening_balance: 0,  reorder_level: '', active: 'TRUE' },
  { item_id: 'ITM-0003', name_en: 'Stapler',  unit: 'piece', opening_balance: 5,  reorder_level: 5,  active: 'TRUE' },
  { item_id: 'ITM-0004', name_en: 'Old Item', unit: 'piece', opening_balance: 0,  reorder_level: '', active: 'FALSE' }
];
const stockIn = [
  { txn_id: 'IN-1', date: '2026-05-03', item_id: 'ITM-0001', qty: 50, month: '2026-05', status: 'active' },
  { txn_id: 'IN-2', date: '2026-06-10', item_id: 'ITM-0002', qty: 20, month: '2026-06', status: 'active' },
  { txn_id: 'IN-3', date: '2026-06-12', item_id: 'ITM-0001', qty: 5,  month: '2026-06', status: 'void' }   // voided -> ignored
];
const stockOut = [
  { txn_id: 'OUT-1', date: '2026-06-05', item_id: 'ITM-0001', qty: 12,  user_id: 'USR-01', section_id: 'SEC-01', month: '2026-06', status: 'active' },
  { txn_id: 'OUT-2', date: '2026-06-06', item_id: 'ITM-0002', qty: 5,   user_id: 'USR-02', section_id: 'SEC-02', month: '2026-06', status: 'active' },
  { txn_id: 'OUT-3', date: '2026-06-07', item_id: 'ITM-0001', qty: 7,   user_id: 'USR-01', section_id: 'SEC-01', month: '2026-06', status: 'active' },
  { txn_id: 'OUT-9', date: '2026-06-09', item_id: 'ITM-0001', qty: 999, user_id: 'USR-01', section_id: 'SEC-01', month: '2026-06', status: 'void' } // voided -> ignored
];

// ---- balances (opening + Σin − Σout, void excluded) ----
const bal = C.computeBalances(items, stockIn, stockOut);
check('balance ITM-0001 = 41  (10 + 50 − 19)', bal['ITM-0001'].balance === 41);
check('balance ITM-0002 = 15  (0 + 20 − 5)',   bal['ITM-0002'].balance === 15);
check('balance ITM-0003 = 5   (opening only)', bal['ITM-0003'].balance === 5);
check('stock-in ignores voided row',           bal['ITM-0001'].in === 50);
check('stock-out ignores voided row',          bal['ITM-0001'].out === 19);

// ---- monthly pivots ----
const mi = C.monthlyPivot(stockIn);
check('monthly-in months sorted',              JSON.stringify(mi.months) === JSON.stringify(['2026-05', '2026-06']));
check('monthly-in ITM-0001 May = 50',          mi.items['ITM-0001'].byMonth['2026-05'] === 50);
check('monthly-in grand = 70 (void excluded)', mi.grand === 70);
const mo = C.monthlyPivot(stockOut);
check('monthly-out ITM-0001 Jun = 19',         mo.items['ITM-0001'].byMonth['2026-06'] === 19);
check('monthly-out grand = 24',                mo.grand === 24);

// ---- user-wise / section-wise ----
const uw = C.userWiseOut(stockOut);
check('user-wise USR-01 total = 19',           uw['USR-01'].total === 19);
check('user-wise USR-01 ITM-0001 = 19',        uw['USR-01'].byItem['ITM-0001'] === 19);
check('user-wise USR-02 total = 5',            uw['USR-02'].total === 5);
const sw = C.sectionWiseOut(stockOut);
check('section-wise SEC-01 total = 19',        sw['SEC-01'].total === 19);
check('section-wise SEC-02 total = 5',         sw['SEC-02'].total === 5);

// ---- low-stock (active only; reorder_level || default) ----
const low = C.lowStock(items, bal, 5).map((x) => x.item.item_id);
check('low-stock includes ITM-0003 (5 ≤ 5)',   low.includes('ITM-0003'));
check('low-stock excludes ITM-0001 (48 > 8)',  !low.includes('ITM-0001'));
check('low-stock excludes inactive ITM-0004',  !low.includes('ITM-0004'));

// drive ITM-0002 below the default threshold and re-check
const stockOut2 = stockOut.concat([{ txn_id: 'OUT-x', date: '2026-06-20', item_id: 'ITM-0002', qty: 14, user_id: 'USR-03', section_id: 'SEC-01', status: 'active' }]);
const bal2 = C.computeBalances(items, stockIn, stockOut2);
check('ITM-0002 balance now 1',                bal2['ITM-0002'].balance === 1);
check('low-stock now includes ITM-0002',       C.lowStock(items, bal2, 5).some((x) => x.item.item_id === 'ITM-0002'));

// ---- trend + top consumers ----
const trend = C.monthlyTrend(stockIn, stockOut, 12);
check('trend spans 2 months',                  trend.length === 2);
const jun = trend.find((t) => t.month === '2026-06');
check('trend Jun in=20 out=24',                jun.in === 20 && jun.out === 24);
const top = C.topConsumers(uw, 1);
check('top consumer USR-01 (19)',              top[0].key === 'USR-01' && top[0].total === 19);

// ---- robustness: string qty, missing status ----
check('num() strips non-numerics',             C.num('১২') === 0 && C.num('12') === 12 && C.num('3.5') === 3.5);
check('isLive() defaults to true',             C.isLive({}) === true && C.isLive({ status: 'void' }) === false);

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
