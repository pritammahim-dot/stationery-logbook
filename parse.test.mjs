/* parse.test.mjs — headless tests for parse.js.  Run: node parse.test.mjs */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('./parse.js');

let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log('  ok   - ' + name); } else { fail++; console.error('  FAIL - ' + name); process.exitCode = 1; } }

const items = [
  { item_id: 'ITM-0003', name_en: 'A4 Paper (80 GSM)', name_bn: 'A4 Paper (80 GSM)' },
  { item_id: 'ITM-0008', name_en: 'Ballpoint Pen (Black)', name_bn: 'Ballpoint Pen (Black)' },
  { item_id: 'ITM-0043', name_en: 'Soap', name_bn: 'Soap' }
];

// number + normalize
check('num bengali+comma → 1200', P.num('১,২০০') === 1200);
check('num "12 pcs" → 12', P.num('12 pcs') === 12);
check('num "3.5" → 3.5', P.num('3.5') === 3.5);
check('normalize strips punctuation', P.normalize('A4 Paper (80 GSM)') === 'a4 paper 80 gsm');

// column detection
const c1 = P.detectColumns(['Item', 'Quantity', 'Remarks']);
check('detect en headers', c1.itemCol === 0 && c1.qtyCol === 1 && c1.remarksCol === 2 && c1.idCol === -1);
const c2 = P.detectColumns(['item_id', 'item', 'unit', 'Quantity']);
check('detect template (id+item+qty)', c2.idCol === 0 && c2.itemCol === 1 && c2.qtyCol === 3);
const c3 = P.detectColumns(['নাম', 'পরিমাণ']);
check('detect bengali headers', c3.itemCol === 0 && c3.qtyCol === 1);

// matching
check('match exact name → ITM-0008', P.matchItemName('ballpoint pen black', items).item.item_id === 'ITM-0008');
check('match substring → ITM-0003 (>=0.9)', (function () { const m = P.matchItemName('A4 Paper', items); return m.item.item_id === 'ITM-0003' && m.score >= 0.9; })());
check('match typo "Sope" → Soap (fuzzy)', (function () { const m = P.matchItemName('Sope', items); return m.item.item_id === 'ITM-0043' && m.score >= 0.5 && m.score < 0.9; })());
check('no match for nonsense (<0.55)', P.matchItemName('zzz qqq vvv', items).score < 0.55);

// resolveRows — template with item_id (exact)
const t = P.resolveRows([['item_id', 'item', 'unit', 'quantity', 'remarks'], ['ITM-0008', 'Ballpoint', 'pcs', '50', 'lot A'], ['ITM-0043', 'Soap', 'pcs', '24', '']], items);
check('template header detected at row 0', t.header === 0);
check('template row1 → ITM-0008 qty 50 matched', t.rows[0].item_id === 'ITM-0008' && t.rows[0].qty === 50 && t.rows[0].status === 'matched');
check('template carries remarks', t.rows[0].remarks === 'lot A');

// resolveRows — arbitrary names (fuzzy + unmatched)
const a = P.resolveRows([['Item', 'Quantity'], ['A4 Paper', '30'], ['Sope', '5'], ['Totally Unknown Thing', '9'], ['', '']], items);
check('names: A4 matched', a.rows[0].item_id === 'ITM-0003' && a.rows[0].qty === 30 && a.rows[0].status === 'matched');
check('names: Sope fuzzy', a.rows[1].item_id === 'ITM-0043' && a.rows[1].status === 'fuzzy');
check('names: unknown → unmatched, no item_id', a.rows[2].item_id === '' && a.rows[2].status === 'unmatched');
check('blank row skipped', a.rows.length === 3);

// resolveRows — no header (fallback col0=name, col1=qty)
const f = P.resolveRows([['Ballpoint Pen (Black)', '12']], items);
check('no-header fallback matches', f.rows.length === 1 && f.rows[0].item_id === 'ITM-0008' && f.rows[0].qty === 12);

// PDF text
const g = P.parsePdfText('A4 Paper (80 GSM) ....... 30\nBallpoint Pen 50 pcs\nThank you for your business');
check('pdf: extracts 2 line-items', g.length === 3);
check('pdf: A4 row', g[1][0].indexOf('A4 Paper') === 0 && g[1][1] === '30');
check('pdf: ballpoint qty 50', g[2][1] === '50');

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
