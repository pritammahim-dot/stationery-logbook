'use strict';

/* ============================ helpers (Bengali) ============================ */
const BN = '০১২৩৪৫৬৭৮৯';
const toBn = (s) => String(s).replace(/[0-9]/g, (d) => BN[+d]);
const bnToEn = (s) => String(s).replace(/[০-৯]/g, (d) => BN.indexOf(d));
const enNum = (s) => Number(bnToEn(String(s)).replace(/[^\d.\-]/g, '')) || 0;
const BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CFG = window.APP_CONFIG || {};
const STATE = {
  sections: [], items: [], users: [], stockIn: [], stockOut: [], cycles: [], requirements: [], meta: {},
  d: {}, lang: localStorage.getItem('sl_lang') || CFG.DEFAULT_LANG || 'bn', view: 'dashboard',
  itemById: new Map(), userById: new Map(), sectionById: new Map(),
  // per-view UI state
  ui: { stockFilter: { q: '', cat: '', low: false }, itemFilter: { q: '', cat: '', inactive: false }, userFilter: { q: '', sec: '', inactive: false }, rep: { type: 'out', from: '', to: '', sec: '', user: '' }, req: { cycleId: '', tab: 'entry', scope: 'section', scopeId: '' } }
};

const L = (bn, en) => (STATE.lang === 'bn' ? bn : en);
const nf = (n) => (STATE.lang === 'bn' ? toBn(n) : String(n));
const lowDefault = () => Number(STATE.meta.low_stock_default || CFG.LOW_STOCK_DEFAULT || 5);

const DEFAULT_UNITS = [{ code: 'piece', bn: 'পিস', en: 'Piece' }, { code: 'ream', bn: 'রিম', en: 'Ream' }, { code: 'box', bn: 'বক্স', en: 'Box' }];
function getUnits() { try { const u = STATE.meta.units; if (u) { const a = typeof u === 'string' ? JSON.parse(u) : u; if (Array.isArray(a) && a.length) return a; } } catch (e) {} return DEFAULT_UNITS; }
const unitMap = () => { const m = {}; getUnits().forEach((u) => { m[u.code] = u; }); return m; };
const unitLabel = (code) => { const u = unitMap()[code]; return u ? (STATE.lang === 'bn' ? (u.bn || u.en || code) : (u.en || u.bn || code)) : code; };
const unitOptions = (sel) => getUnits().map((u) => `<option value="${esc(u.code)}" ${u.code === sel ? 'selected' : ''}>${esc(STATE.lang === 'bn' ? (u.bn || u.en) : (u.en || u.bn))}</option>`).join('');
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);

const itemOf = (id) => STATE.itemById.get(id);
const userOf = (id) => STATE.userById.get(id);
const sectionOf = (id) => STATE.sectionById.get(id);
const itemName = (it) => it ? (STATE.lang === 'bn' ? (it.name_bn || it.name_en) : (it.name_en || it.name_bn)) : '—';
const itemNameById = (id) => itemName(itemOf(id)) || id;
const userName = (u) => u ? (u.name_bn || u.name_en || u.user_id) : '—';
const userNameById = (id) => { const u = userOf(id); return u ? userName(u) : id; };
const sectionName = (s) => s ? (STATE.lang === 'bn' ? (s.name_bn || s.name_en) : (s.name_en || s.name_bn)) : '—';
const sectionNameById = (id) => { const s = sectionOf(id); return s ? sectionName(s) : (id || '—'); };
const balanceOf = (id) => (STATE.d.balances && STATE.d.balances[id] ? STATE.d.balances[id].balance : 0);
const isActive = (row) => String(row.active == null ? 'TRUE' : row.active).toLowerCase() !== 'false';
const isVoid = (row) => String(row.status || '').toLowerCase() === 'void';

function todayISO() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function dDate(iso) { if (!iso) return ''; const s = String(iso).slice(0, 10); const [y, m, dd] = s.split('-'); if (!dd) return s; return STATE.lang === 'bn' ? `${toBn(+dd)} ${BN_MONTHS[+m - 1]} ${toBn(y)}` : `${dd} ${EN_MONTHS[+m - 1]} ${y}`; }
function monthLabel(ym) { const [y, m] = String(ym).split('-'); const i = +m - 1; return STATE.lang === 'bn' ? `${BN_MONTHS[i]} ${toBn(y)}` : `${EN_MONTHS[i]} ${y}`; }

/* ============================ init ============================ */
window.addEventListener('DOMContentLoaded', init);

async function init() {
  applyChrome();
  wireChrome();
  await load();
  // register the service worker only on a real host (keeps local preview always-fresh)
  if ('serviceWorker' in navigator && !/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

function applyChrome() {
  $('appTitle').textContent = L(CFG.APP_TITLE_BN || 'স্টেশনারি স্টক রেজিস্টার', CFG.APP_TITLE_EN || 'Stationery Stock Register');
  $('appSub').textContent = L(CFG.OFFICE_NAME_BN || '', CFG.OFFICE_NAME_EN || '');
  $('langBtn').textContent = STATE.lang === 'bn' ? 'EN' : 'বাং';
  if (API.DEMO) $('demoBadge').hidden = false;
}

function wireChrome() {
  $('tabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) switchView(b.dataset.view); });
  $('langBtn').addEventListener('click', () => { STATE.lang = STATE.lang === 'bn' ? 'en' : 'bn'; localStorage.setItem('sl_lang', STATE.lang); applyChrome(); renderView(); });
  $('pinChip').addEventListener('click', onPinChip);
  $('modalClose').addEventListener('click', closeModal);
  $('modalOverlay').addEventListener('click', (e) => { if (e.target === $('modalOverlay')) closeModal(); });
}

async function load() {
  const res = await API.getAll();
  if (!res || !res.ok) { $('loading').textContent = L('ডেটা লোড করা যায়নি — ', 'Could not load data — ') + (res && res.data ? (res.data.msg || res.code) : 'error'); return; }
  Object.assign(STATE, { sections: res.data.sections || [], items: res.data.items || [], users: res.data.users || [], stockIn: res.data.stockIn || [], stockOut: res.data.stockOut || [], cycles: res.data.cycles || [], requirements: res.data.requirements || [], meta: res.data.meta || {} });
  recompute();
  $('loading').hidden = true;
  renderView();
}

function recompute() {
  STATE.itemById = new Map(STATE.items.map((i) => [i.item_id, i]));
  STATE.userById = new Map(STATE.users.map((u) => [u.user_id, u]));
  STATE.sectionById = new Map(STATE.sections.map((s) => [s.section_id, s]));
  STATE.d = Compute.recomputeAll(STATE, lowDefault());
}

/* ============================ view switching ============================ */
function switchView(view) {
  if (view === STATE.view) return;
  STATE.view = view;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
  renderView();
  window.scrollTo(0, 0);
}

function renderView() {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const map = { dashboard: renderDashboard, stockin: renderStockIn, stockout: renderStockOut, stock: renderStock, items: renderItems, users: renderUsers, requirements: renderRequirements, reports: renderReports, slip: () => {} };
  const id = 'view-' + STATE.view;
  const host = $(id); if (!host) return;
  host.classList.add('active');
  (map[STATE.view] || (() => {}))();
}

/* ============================ PIN gate ============================ */
function onPinChip() {
  if (API.hasSecret()) {
    API.setSecret('');
    setLockUI(false);
    toast(L('লক করা হয়েছে', 'Locked'), 'ok');
  } else openPin();
}
function setLockUI(unlocked) {
  const chip = $('pinChip');
  chip.classList.toggle('unlocked', unlocked);
  chip.querySelector('#pinLabel').textContent = unlocked ? L('আনলকড', 'Unlocked') : L('লক', 'Locked');
  chip.firstChild.textContent = unlocked ? '🔓 ' : '🔒 ';
  if (STATE.view === 'items' || STATE.view === 'users') renderView();
}
function openPin(onOk) {
  modal(L('পিন দিন', 'Enter PIN'),
    `<div class="field"><label>${L('সম্পাদনার পিন', 'Editing PIN')}</label>
       <input type="password" id="pinInput" inputmode="numeric" autocomplete="off" placeholder="••••" />
       <div class="hint" id="pinHint">${API.DEMO ? L('ডেমো পিন: ', 'Demo PIN: ') + API.DEMO_PIN : L('স্টোরকিপারের পিন', "Storekeeper's PIN")}</div></div>`,
    [{ label: L('আনলক', 'Unlock'), primary: true, onClick: submitPin }]);
  setTimeout(() => { const el = $('pinInput'); if (el) { el.focus(); el.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitPin(); }); } }, 30);
  openPin._cb = onOk;
}
async function submitPin() {
  const pin = ($('pinInput') || {}).value || '';
  if (!pin) return;
  API.setSecret(pin);
  const res = await API.auth();
  if (res && res.ok) {
    setLockUI(true); closeModal(); toast(L('আনলক হয়েছে', 'Unlocked'), 'ok');
    if (openPin._cb) { const cb = openPin._cb; openPin._cb = null; cb(); }
  } else {
    API.setSecret(''); const h = $('pinHint'); if (h) { h.textContent = L('ভুল পিন', 'Wrong PIN'); h.className = 'hint bad'; }
    const el = $('pinInput'); if (el) el.classList.add('bad');
  }
}
function requireWrite(fn) { if (API.hasSecret()) fn(); else openPin(fn); }

/* central write handler: returns the result object (or null on handled failure) */
async function doWrite(promise, okMsg) {
  const res = await promise;
  if (res && res.ok) { await load(); if (okMsg) toast(okMsg, 'ok'); return res; }
  const code = res ? res.code : 'error', d = (res && res.data) || {};
  if (code === 'bad_secret') { API.setSecret(''); setLockUI(false); toast(L('ভুল পিন — আবার আনলক করুন', 'Wrong PIN — unlock again'), 'err'); }
  else if (code === 'insufficient_stock') toast(L(`স্টকে যথেষ্ট নেই (ব্যালেন্স ${nf(d.balance)})`, `Insufficient stock (balance ${d.balance})`), 'err');
  else if (code === 'validation') toast(L('তথ্য সঠিক নয়: ', 'Invalid: ') + (d.field || ''), 'err');
  else if (code === 'not_found') toast(L('খুঁজে পাওয়া যায়নি', 'Not found'), 'err');
  else if (code === 'network') toast(L('নেটওয়ার্ক সমস্যা', 'Network error'), 'err');
  else toast(L('সমস্যা হয়েছে', 'Something went wrong') + (d.msg ? ': ' + d.msg : ''), 'err');
  return null;
}

/* ============================ modal & toast ============================ */
function modal(title, bodyHtml, buttons) {
  const _m = document.querySelector('#modalOverlay .modal'); if (_m) _m.style.maxWidth = '';   // reset width (import review widens it)
  $('modalTitle').textContent = title;
  $('modalBody').innerHTML = bodyHtml;
  const foot = $('modalFoot'); foot.innerHTML = '';
  (buttons || []).forEach((b) => {
    const btn = document.createElement('button');
    btn.className = 'btn ' + (b.primary ? 'btn-primary' : b.danger ? 'btn-danger' : 'btn-ghost');
    btn.textContent = b.label; btn.addEventListener('click', b.onClick); foot.appendChild(btn);
  });
  $('modalOverlay').classList.add('show');
}
function closeModal() { $('modalOverlay').classList.remove('show'); $('modalBody').innerHTML = ''; }
function toast(msg, kind) {
  const el = document.createElement('div'); el.className = 'toast ' + (kind || '');
  el.textContent = msg; $('toastWrap').appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2800);
}

/* ============================ DASHBOARD ============================ */
function renderDashboard() {
  const d = STATE.d;
  const thisMonth = todayISO().slice(0, 7);
  const inThis = d.monthlyIn.totalsByMonth[thisMonth] || 0;
  const outThis = d.monthlyOut.totalsByMonth[thisMonth] || 0;
  const activeItems = STATE.items.filter(isActive).length;
  const activeUsers = STATE.users.filter(isActive).length;

  const kpis = [
    { label: L('মোট আইটেম', 'Items'), val: nf(activeItems), sub: L(nf(STATE.items.length) + ' মোট', STATE.items.length + ' total') },
    { label: L('কম-স্টক', 'Low stock'), val: nf(d.lowStock.length), sub: L('রি-অর্ডার দরকার', 'need reorder'), warn: d.lowStock.length > 0 },
    { label: L('এ মাসে গৃহীত', 'Received (mo)'), val: nf(inThis), sub: monthLabel(thisMonth) },
    { label: L('এ মাসে বিতরণ', 'Issued (mo)'), val: nf(outThis), sub: monthLabel(thisMonth) }
  ];
  const kpiHtml = `<div class="kpi-grid">${kpis.map((k) => `<div class="kpi ${k.warn ? 'warn' : ''}"><div class="k-label">${k.label}</div><div class="k-val">${k.val}</div><div class="k-sub">${k.sub}</div></div>`).join('')}</div>`;

  // low stock card
  const low = d.lowStock.slice(0, 12);
  const lowHtml = `<div class="card"><div class="card-head"><h2>${L('কম-স্টক আইটেম', 'Low-stock items')}</h2><span class="sub">${L('ব্যালেন্স ≤ রি-অর্ডার লেভেল', 'balance ≤ reorder level')}</span></div>` +
    (low.length ? `<div class="list">${low.map((x) => {
      const it = itemOf(x.item.item_id);
      return `<div class="list-item"><span class="name">${esc(itemName(it))} <span class="tag">${unitLabel(it.unit)}</span></span>
        <span class="meta">${L('ব্যালেন্স', 'bal')} <b class="${x.balance <= 0 ? 'badge badge-neg' : ''}">${nf(x.balance)}</b> / ${L('রি-অর্ডার', 'reorder')} ${nf(x.reorder)}</span>
        <button class="btn btn-sm" onclick="quickStockIn('${it.item_id}')">+ ${L('স্টক', 'Stock')}</button></div>`;
    }).join('')}</div>` : `<div class="empty">${L('সব আইটেমের স্টক পর্যাপ্ত ✓', 'All items sufficiently stocked ✓')}</div>`) + `</div>`;

  // trend chart
  const trendHtml = `<div class="card"><div class="card-head"><h2>${L('মাসিক গতিপ্রকৃতি', 'Monthly trend')}</h2><span class="sub">${L('গৃহীত vs বিতরণ', 'received vs issued')}</span></div>
    <div class="chart">${trendChartSVG(d.trend)}</div>
    <div class="legend"><span><i style="background:var(--brand)"></i>${L('গৃহীত', 'Received')}</span><span><i style="background:#e08a3c"></i>${L('বিতরণ', 'Issued')}</span></div></div>`;

  // top consumers
  const topU = Compute.topConsumers(d.userWise, 5);
  const maxU = Math.max(1, ...topU.map((t) => t.total));
  const topUHtml = topU.length ? topU.map((t) => `<div class="list-item"><span class="name">${esc(userNameById(t.key))}<div class="meta">${sectionNameById((userOf(t.key) || {}).section_id)}</div></span><div class="bar-track"><div class="bar-mini" style="width:${Math.round(t.total / maxU * 100)}%"></div></div><span class="meta"><b>${nf(t.total)}</b></span></div>`).join('') : `<div class="empty">${L('কোনো বিতরণ নেই', 'No issues yet')}</div>`;
  const topHtml = `<div class="card"><div class="card-head"><h2>${L('শীর্ষ গ্রহীতা', 'Top consumers')}</h2></div><div class="list">${topUHtml}</div></div>`;

  $('view-dashboard').innerHTML = kpiHtml + lowHtml + `<div class="row"><div style="flex:2;min-width:300px">${trendHtml}</div><div style="flex:1;min-width:260px">${topHtml}</div></div>`;
}

function trendChartSVG(trend) {
  if (!trend.length) return `<div class="empty">${L('পর্যাপ্ত তথ্য নেই', 'Not enough data')}</div>`;
  const W = Math.max(320, trend.length * 60 + 20), H = 180, pb = 28, pt = 12, plot = H - pb - pt;
  const max = Math.max(1, ...trend.map((t) => Math.max(t.in, t.out)));
  const gw = (W - 20) / trend.length;
  let bars = '';
  trend.forEach((t, i) => {
    const cx = 10 + i * gw, bw = Math.min(16, gw / 3);
    const inH = t.in / max * plot, outH = t.out / max * plot;
    const x1 = cx + gw / 2 - bw - 2, x2 = cx + gw / 2 + 2;
    bars += `<rect x="${x1.toFixed(1)}" y="${(pt + plot - inH).toFixed(1)}" width="${bw}" height="${inH.toFixed(1)}" rx="2" fill="var(--brand)"></rect>`;
    bars += `<rect x="${x2.toFixed(1)}" y="${(pt + plot - outH).toFixed(1)}" width="${bw}" height="${outH.toFixed(1)}" rx="2" fill="#e08a3c"></rect>`;
    bars += `<text x="${(cx + gw / 2).toFixed(1)}" y="${H - 9}" text-anchor="middle" font-size="10" fill="#5e7068">${esc(monthLabel(t.month).split(' ')[0])}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img"><line x1="6" y1="${pt + plot}" x2="${W - 6}" y2="${pt + plot}" stroke="var(--line)"></line>${bars}</svg>`;
}

window.quickStockIn = function (itemId) { switchView('stockin'); setTimeout(() => { const sel = $('siItem'); if (sel) { sel.value = itemId; $('siQty').focus(); } }, 60); };

/* ============================ STOCK IN ============================ */
function itemOptions(selectedId) {
  return STATE.items.filter(isActive).slice().sort((a, b) => itemName(a).localeCompare(itemName(b)))
    .map((i) => `<option value="${i.item_id}" ${i.item_id === selectedId ? 'selected' : ''}>${esc(itemName(i))} — ${unitLabel(i.unit)}</option>`).join('');
}
function userOptions(selectedId) {
  return STATE.users.filter(isActive).slice().sort((a, b) => userName(a).localeCompare(userName(b)))
    .map((u) => `<option value="${u.user_id}" ${u.user_id === selectedId ? 'selected' : ''}>${esc(userName(u))}</option>`).join('');
}

function renderStockIn() {
  const recent = STATE.stockIn.slice().reverse().slice(0, 25);
  $('view-stockin').innerHTML = `
    <div class="card"><div class="card-head"><h2>${L('স্টক গ্রহণ (ইন)', 'Stock In')}</h2><span class="sub">${L('নতুন মালামাল গুদামে যোগ করুন', 'add received supplies')}</span><span class="spacer"></span>
      <button class="btn btn-sm" onclick="downloadImportTemplate()">⬇ ${L('টেমপ্লেট', 'Template')}</button>
      <button class="btn btn-sm" onclick="openImport()">📄 ${L('ফাইল থেকে আমদানি', 'Import file')}</button></div>
      <div class="form-grid two">
        <div class="field"><label>${L('তারিখ', 'Date')}</label><input type="date" id="siDate" value="${todayISO()}"></div>
        <div class="field"><label>${L('আইটেম', 'Item')}</label><select id="siItem">${itemOptions()}</select></div>
        <div class="field"><label>${L('পরিমাণ', 'Quantity')}</label><input type="number" id="siQty" min="0" step="1" placeholder="0"></div>
        <div class="field"><label>${L('মন্তব্য', 'Remarks')}</label><input type="text" id="siRemarks" placeholder="${L('ঐচ্ছিক', 'optional')}"></div>
      </div>
      <div class="btn-row" style="margin-top:14px"><button class="btn btn-primary" id="siSave">${L('সংরক্ষণ করুন', 'Save')}</button></div>
    </div>
    <div class="card"><div class="card-head"><h2>${L('সাম্প্রতিক গ্রহণ', 'Recent receipts')}</h2></div>
      ${recent.length ? `<div class="table-wrap"><table><thead><tr><th>${L('তারিখ', 'Date')}</th><th>${L('আইটেম', 'Item')}</th><th class="num">${L('পরিমাণ', 'Qty')}</th><th>${L('মন্তব্য', 'Remarks')}</th><th></th></tr></thead><tbody>
        ${recent.map((r) => `<tr class="${isVoid(r) ? 'void' : ''}"><td>${dDate(r.date)}</td><td>${esc(itemNameById(r.item_id))}</td><td class="num">${nf(r.qty)} ${unitLabel((itemOf(r.item_id) || {}).unit)}</td><td>${esc(r.remarks || '')}</td>
          <td class="t-actions">${isVoid(r) ? `<span class="badge badge-void">${L('বাতিল', 'void')}</span>` : `<button class="btn btn-sm btn-danger" onclick="voidTxn('stockIn','${r.txn_id}')">${L('বাতিল', 'Void')}</button>`}</td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty">${L('কোনো এন্ট্রি নেই', 'No entries yet')}</div>`}
    </div>`;
  $('siSave').addEventListener('click', saveStockIn);
}
function saveStockIn() {
  const date = $('siDate').value, item_id = $('siItem').value, qty = enNum($('siQty').value), remarks = $('siRemarks').value.trim();
  if (!date || !item_id) return toast(L('তারিখ ও আইটেম দিন', 'Pick date and item'), 'err');
  if (!(qty > 0)) { $('siQty').classList.add('bad'); return toast(L('পরিমাণ লিখুন', 'Enter a quantity'), 'err'); }
  requireWrite(async () => { const r = await doWrite(API.stockIn({ date, item_id, qty, remarks }), L('গ্রহণ সংরক্ষিত হয়েছে', 'Receipt saved')); if (r) renderStockIn(); });
}

/* ============================ STOCK OUT ============================ */
function renderStockOut() {
  const recent = STATE.stockOut.slice().reverse().slice(0, 25);
  $('view-stockout').innerHTML = `
    <div class="card"><div class="card-head"><h2>${L('স্টক বিতরণ (আউট)', 'Stock Out')}</h2><span class="sub">${L('কর্মীকে মালামাল ইস্যু করুন', 'issue supplies to staff')}</span></div>
      <div class="form-grid two">
        <div class="field"><label>${L('তারিখ', 'Date')}</label><input type="date" id="soDate" value="${todayISO()}"></div>
        <div class="field"><label>${L('ক্রয় চক্র', 'Purchase cycle')}</label><select id="soCycle">${cycleSelectForOut()}</select><div class="hint" id="soQuota"></div></div>
        <div class="field"><label>${L('কর্মী', 'User')}</label><select id="soUser"><option value="">${L('— নির্বাচন —', '— select —')}</option>${userOptions()}</select>
          <div class="hint" id="soSection">${L('সেকশন স্বয়ংক্রিয়ভাবে আসবে', 'section auto-fills')}</div></div>
        <div class="field"><label>${L('আইটেম', 'Item')}</label><select id="soItem"><option value="">${L('— নির্বাচন —', '— select —')}</option>${itemOptions()}</select>
          <div class="hint" id="soBal">${L('ব্যালেন্স দেখাবে', 'balance shown here')}</div></div>
        <div class="field"><label>${L('পরিমাণ', 'Quantity')}</label><input type="number" id="soQty" min="0" step="1" placeholder="0">
          <div class="hint" id="soWarn"></div></div>
      </div>
      <div class="btn-row" style="margin-top:14px">
        <button class="btn btn-primary" id="soSave">${L('ইস্যু করুন', 'Issue')}</button>
        <label class="check" id="soOverrideWrap" hidden><input type="checkbox" id="soOverride"> ${L('ব্যালেন্সের বেশি ইস্যু (নেগেটিভ)', 'allow over-issue')}</label>
      </div>
    </div>
    <div class="card"><div class="card-head"><h2>${L('সাম্প্রতিক বিতরণ', 'Recent issues')}</h2></div>
      ${recent.length ? `<div class="table-wrap"><table><thead><tr><th>${L('তারিখ', 'Date')}</th><th>${L('স্লিপ', 'Slip')}</th><th>${L('কর্মী', 'User')}</th><th>${L('সেকশন', 'Section')}</th><th>${L('আইটেম', 'Item')}</th><th class="num">${L('পরিমাণ', 'Qty')}</th><th></th></tr></thead><tbody>
        ${recent.map((r) => `<tr class="${isVoid(r) ? 'void' : ''}"><td>${dDate(r.date)}</td><td>${esc(r.slip_no || '')}</td><td>${esc(userNameById(r.user_id))}</td><td>${esc(sectionNameById(r.section_id))}</td><td>${esc(itemNameById(r.item_id))}</td><td class="num">${nf(r.qty)}</td>
          <td class="t-actions">${isVoid(r) ? `<span class="badge badge-void">${L('বাতিল', 'void')}</span>` : `<button class="btn btn-sm" onclick="showSlip('${r.txn_id}')">${L('স্লিপ', 'Slip')}</button><button class="btn btn-sm btn-danger" onclick="voidTxn('stockOut','${r.txn_id}')">${L('বাতিল', 'Void')}</button>`}</td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty">${L('কোনো এন্ট্রি নেই', 'No entries yet')}</div>`}
    </div>`;
  $('soUser').addEventListener('change', onSoUser);
  $('soItem').addEventListener('change', onSoBal);
  $('soQty').addEventListener('input', onSoBal);
  $('soCycle').addEventListener('change', onSoBal);
  $('soSave').addEventListener('click', saveStockOut);
}
function onSoUser() { const u = userOf($('soUser').value); $('soSection').textContent = u ? L('সেকশন: ', 'Section: ') + sectionNameById(u.section_id) : L('সেকশন স্বয়ংক্রিয়ভাবে আসবে', 'section auto-fills'); onSoBal(); }
function onSoBal() {
  const id = $('soItem').value, bal = id ? balanceOf(id) : null, qty = enNum($('soQty').value);
  const it = itemOf(id);
  $('soBal').innerHTML = id ? L('ব্যালেন্স: ', 'Balance: ') + `<b>${nf(bal)}</b> ${unitLabel(it.unit)}` : L('ব্যালেন্স দেখাবে', 'balance shown here');
  const over = qty > bal && id;
  $('soQty').classList.toggle('bad', !!over && !($('soOverride') || {}).checked);
  $('soOverrideWrap').hidden = !over;
  const w = $('soWarn');
  if (over) { w.textContent = L(`স্টকে নেই — ব্যালেন্স ${nf(bal)}`, `Not enough — balance ${bal}`); w.className = 'hint bad'; }
  else if (id && qty > 0) { w.textContent = L(`ইস্যুর পর ব্যালেন্স: ${nf(bal - qty)}`, `Balance after: ${bal - qty}`); w.className = 'hint good'; }
  else { w.textContent = ''; w.className = 'hint'; }
  // procurement quota (warn but allow)
  const qEl = $('soQuota');
  if (qEl) {
    const cycleId = ($('soCycle') || {}).value || '', uid = ($('soUser') || {}).value || '';
    if (cycleId && uid && id && qty > 0) {
      const u = userOf(uid);
      const usrQ = Compute.quotaRemaining(STATE, cycleId, 'user', uid, id);
      const secQ = Compute.quotaRemaining(STATE, cycleId, 'section', u ? u.section_id : '', id);
      if (usrQ.required > 0 && qty > usrQ.remaining) { qEl.textContent = L(`কর্মীর চাহিদা সীমা ছাড়াবে (বাকি ${nf(usrQ.remaining)})`, `Over user limit (remaining ${usrQ.remaining})`); qEl.className = 'hint bad'; }
      else if (secQ.required > 0 && qty > secQ.remaining) { qEl.textContent = L(`সেকশনের চাহিদা সীমা ছাড়াবে (বাকি ${nf(secQ.remaining)})`, `Over section limit (remaining ${secQ.remaining})`); qEl.className = 'hint bad'; }
      else if (usrQ.required > 0 || secQ.required > 0) { const base = usrQ.required > 0 ? usrQ : secQ; qEl.textContent = L(`চাহিদা সীমার মধ্যে (বাকি ${nf(base.remaining - qty)})`, `Within limit (remaining ${base.remaining - qty})`); qEl.className = 'hint good'; }
      else { qEl.textContent = ''; qEl.className = 'hint'; }
    } else { qEl.textContent = ''; qEl.className = 'hint'; }
  }
}
function saveStockOut() {
  const date = $('soDate').value, user_id = $('soUser').value, item_id = $('soItem').value, qty = enNum($('soQty').value);
  if (!date || !user_id || !item_id) return toast(L('তারিখ, কর্মী ও আইটেম দিন', 'Pick date, user and item'), 'err');
  if (!(qty > 0)) { $('soQty').classList.add('bad'); return toast(L('পরিমাণ লিখুন', 'Enter a quantity'), 'err'); }
  const allowNegative = ($('soOverride') || {}).checked || false;
  const cycle_id = ($('soCycle') || {}).value || '';
  if (qty > balanceOf(item_id) && !allowNegative) return toast(L('স্টকে যথেষ্ট নেই', 'Insufficient stock'), 'err');
  requireWrite(async () => {
    const r = await doWrite(API.stockOut({ date, user_id, item_id, qty, allowNegative, cycle_id }), L('বিতরণ সংরক্ষিত হয়েছে', 'Issue saved'));
    if (r && r.data && r.data.txn) { const txn = r.data.txn; renderStockOut(); offerSlip(txn.txn_id); }
  });
}
function offerSlip(txnId) {
  modal(L('বিতরণ সম্পন্ন', 'Issue recorded'), `<p>${L('ইস্যু স্লিপ প্রিন্ট করবেন?', 'Print the issue slip?')}</p>`,
    [{ label: L('স্লিপ দেখুন', 'View slip'), primary: true, onClick: () => { closeModal(); showSlip(txnId); } }, { label: L('না', 'No'), onClick: closeModal }]);
}

/* ============================ STOCK (balances) ============================ */
function categories() { return [...new Set(STATE.items.map((i) => i.category).filter(Boolean))].sort(); }
function renderStock() {
  const f = STATE.ui.stockFilter;
  const cats = categories();
  let rows = STATE.items.filter(isActive);
  if (f.cat) rows = rows.filter((i) => i.category === f.cat);
  if (f.q) { const q = bnToEn(f.q).toLowerCase(); rows = rows.filter((i) => (i.name_bn + ' ' + i.name_en + ' ' + i.item_id).toLowerCase().includes(q)); }
  rows = rows.map((i) => ({ i, b: STATE.d.balances[i.item_id] || { in: 0, out: 0, balance: 0 }, reorder: Compute.reorderOf(i, lowDefault()) }));
  if (f.low) rows = rows.filter((r) => r.b.balance <= r.reorder);
  rows.sort((a, b) => itemName(a.i).localeCompare(itemName(b.i)));

  $('view-stock').innerHTML = `
    <div class="card"><div class="card-head"><h2>${L('স্টক ব্যালেন্স', 'Stock balances')}</h2><span class="sub">${L(nf(rows.length) + ' আইটেম', rows.length + ' items')}</span>
      <span class="spacer"></span><button class="btn btn-sm" onclick="exportStockCSV()">⬇ CSV</button><button class="btn btn-sm" onclick="window.print()">🖨 ${L('প্রিন্ট', 'Print')}</button></div>
      <div class="toolbar no-print">
        <input class="grow" type="search" placeholder="${L('খুঁজুন…', 'Search…')}" value="${esc(f.q)}" oninput="STATE.ui.stockFilter.q=this.value;renderStock()">
        <select onchange="STATE.ui.stockFilter.cat=this.value;renderStock()"><option value="">${L('সব ক্যাটাগরি', 'All categories')}</option>${cats.map((c) => `<option ${c === f.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <label class="check"><input type="checkbox" ${f.low ? 'checked' : ''} onchange="STATE.ui.stockFilter.low=this.checked;renderStock()"> ${L('শুধু কম-স্টক', 'Low only')}</label>
      </div>
      <div class="table-wrap"><table><thead><tr><th>${L('আইটেম', 'Item')}</th><th>${L('ক্যাটাগরি', 'Category')}</th><th>${L('একক', 'Unit')}</th><th class="num">${L('গৃহীত', 'In')}</th><th class="num">${L('বিতরণ', 'Out')}</th><th class="num">${L('ব্যালেন্স', 'Balance')}</th><th class="num">${L('রি-অর্ডার', 'Reorder')}</th><th></th></tr></thead><tbody>
        ${rows.length ? rows.map((r) => `<tr class="${r.b.balance <= r.reorder ? 'low' : ''}"><td>${esc(itemName(r.i))}</td><td><span class="tag">${esc(r.i.category || '—')}</span></td><td>${unitLabel(r.i.unit)}</td><td class="num">${nf(r.b.in)}</td><td class="num">${nf(r.b.out)}</td><td class="num"><b class="${r.b.balance <= 0 ? 'badge badge-neg' : ''}">${nf(r.b.balance)}</b></td><td class="num">${nf(r.reorder)}</td><td>${r.b.balance <= r.reorder ? `<span class="badge badge-low">${L('কম', 'low')}</span>` : ''}</td></tr>`).join('') : `<tr><td colspan="8"><div class="empty">${L('কিছু পাওয়া যায়নি', 'Nothing found')}</div></td></tr>`}
      </tbody></table></div></div>`;
}
window.exportStockCSV = function () {
  const head = ['item_id', 'name', 'category', 'unit', 'in', 'out', 'balance', 'reorder'];
  const lines = STATE.items.filter(isActive).map((i) => { const b = STATE.d.balances[i.item_id] || { in: 0, out: 0, balance: 0 }; return [i.item_id, i.name_en || i.name_bn, i.category || '', i.unit, b.in, b.out, b.balance, Compute.reorderOf(i, lowDefault())]; });
  downloadCSV('stock_balances.csv', head, lines);
};

/* ============================ ITEMS (master CRUD) ============================ */
function renderItems() {
  const f = STATE.ui.itemFilter, cats = categories(), unlocked = API.hasSecret();
  let rows = STATE.items.slice();
  if (!f.inactive) rows = rows.filter(isActive);
  if (f.cat) rows = rows.filter((i) => i.category === f.cat);
  if (f.q) { const q = bnToEn(f.q).toLowerCase(); rows = rows.filter((i) => (i.name_bn + ' ' + i.name_en + ' ' + i.item_id).toLowerCase().includes(q)); }
  rows.sort((a, b) => itemName(a).localeCompare(itemName(b)));
  $('view-items').innerHTML = `
    <div class="card"><div class="card-head"><h2>${L('আইটেম তালিকা', 'Items')}</h2><span class="sub">${L(nf(rows.length) + ' টি', rows.length + '')}</span><span class="spacer"></span>
      <button class="btn btn-sm" onclick="openManageUnits()">⚙ ${L('একক', 'Units')}</button>
      <button class="btn btn-primary btn-sm" onclick="openItemModal()">+ ${L('নতুন আইটেম', 'New item')}</button></div>
      <div class="toolbar no-print">
        <input class="grow" type="search" placeholder="${L('খুঁজুন…', 'Search…')}" value="${esc(f.q)}" oninput="STATE.ui.itemFilter.q=this.value;renderItems()">
        <select onchange="STATE.ui.itemFilter.cat=this.value;renderItems()"><option value="">${L('সব ক্যাটাগরি', 'All categories')}</option>${cats.map((c) => `<option ${c === f.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <label class="check"><input type="checkbox" ${f.inactive ? 'checked' : ''} onchange="STATE.ui.itemFilter.inactive=this.checked;renderItems()"> ${L('নিষ্ক্রিয় দেখান', 'Show inactive')}</label>
      </div>
      <div class="table-wrap"><table><thead><tr><th>${L('নাম', 'Name')}</th><th>${L('একক', 'Unit')}</th><th>${L('ক্যাটাগরি', 'Category')}</th><th class="num">${L('রি-অর্ডার', 'Reorder')}</th><th class="num">${L('ওপেনিং', 'Opening')}</th><th>${L('অবস্থা', 'Status')}</th><th></th></tr></thead><tbody>
        ${rows.map((i) => `<tr><td>${esc(itemName(i))}${i.name_en && i.name_bn && i.name_en !== i.name_bn ? `<div class="meta muted" style="font-size:.75rem">${esc(STATE.lang === 'bn' ? i.name_en : i.name_bn)}</div>` : ''}</td><td>${unitLabel(i.unit)}</td><td><span class="tag">${esc(i.category || '—')}</span></td><td class="num">${i.reorder_level === '' || i.reorder_level == null ? '—' : nf(i.reorder_level)}</td><td class="num">${nf(i.opening_balance || 0)}</td><td>${isActive(i) ? `<span class="badge badge-ok">${L('সক্রিয়', 'active')}</span>` : `<span class="badge badge-void">${L('নিষ্ক্রিয়', 'inactive')}</span>`}</td><td><button class="btn btn-sm" onclick="openItemModal('${i.item_id}')">${L('সম্পাদনা', 'Edit')}</button></td></tr>`).join('')}
      </tbody></table></div></div>`;
}
window.openItemModal = function (itemId) {
  requireWrite(() => {
    const it = itemId ? itemOf(itemId) : null, cats = categories();
    modal(it ? L('আইটেম সম্পাদনা', 'Edit item') : L('নতুন আইটেম', 'New item'),
      `<div class="form-grid">
        <div class="field"><label>${L('নাম (বাংলা/মূল)', 'Name (primary)')}</label><input type="text" id="itName" value="${esc(it ? it.name_bn : '')}"></div>
        <div class="field"><label>${L('নাম (ইংরেজি)', 'Name (English)')}</label><input type="text" id="itNameEn" value="${esc(it ? it.name_en : '')}"></div>
        <div class="form-grid two" style="gap:14px">
          <div class="field"><label>${L('একক', 'Unit')}</label><select id="itUnit">${unitOptions(it ? it.unit : '')}</select></div>
          <div class="field"><label>${L('ক্যাটাগরি', 'Category')}</label><input type="text" id="itCat" list="catList" value="${esc(it ? it.category : '')}"><datalist id="catList">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
          <div class="field"><label>${L('রি-অর্ডার লেভেল', 'Reorder level')}</label><input type="number" id="itReorder" min="0" value="${it && it.reorder_level !== '' && it.reorder_level != null ? esc(it.reorder_level) : ''}" placeholder="${nf(lowDefault())}"></div>
          <div class="field"><label>${L('ওপেনিং ব্যালেন্স', 'Opening balance')}</label><input type="number" id="itOpening" min="0" value="${esc(it ? (it.opening_balance || 0) : 0)}" ${it ? '' : ''}></div>
        </div>
        <div class="field"><label>${L('স্পেসিফিকেশন', 'Specification')}</label><input type="text" id="itSpec" value="${esc(it ? it.spec : '')}" placeholder="${L('ঐচ্ছিক', 'optional')}"></div>
        ${it ? `<label class="check"><input type="checkbox" id="itActive" ${isActive(it) ? 'checked' : ''}> ${L('সক্রিয়', 'Active')}</label>` : ''}
      </div>`,
      [{ label: L('সংরক্ষণ', 'Save'), primary: true, onClick: () => saveItem(itemId) }, { label: L('বাতিল', 'Cancel'), onClick: closeModal }]);
  });
};
async function saveItem(itemId) {
  const p = { name_bn: $('itName').value.trim(), name_en: $('itNameEn').value.trim(), unit: $('itUnit').value, category: $('itCat').value.trim(), reorder_level: $('itReorder').value === '' ? '' : enNum($('itReorder').value), opening_balance: enNum($('itOpening').value), spec: $('itSpec').value.trim() };
  if (!p.name_bn) return toast(L('নাম দিন', 'Enter a name'), 'err');
  let res;
  if (itemId) { p.item_id = itemId; if ($('itActive')) p.active = $('itActive').checked; res = await doWrite(API.updateItem(p), L('আইটেম হালনাগাদ হয়েছে', 'Item updated')); }
  else res = await doWrite(API.addItem(p), L('আইটেম যোগ হয়েছে', 'Item added'));
  if (res) { closeModal(); renderItems(); }
}

/* ============================ USERS (master CRUD) ============================ */
function renderUsers() {
  const f = STATE.ui.userFilter;
  let rows = STATE.users.slice();
  if (!f.inactive) rows = rows.filter(isActive);
  if (f.sec) rows = rows.filter((u) => u.section_id === f.sec);
  if (f.q) { const q = bnToEn(f.q).toLowerCase(); rows = rows.filter((u) => (u.name_bn + ' ' + (u.name_en || '') + ' ' + u.user_id).toLowerCase().includes(q)); }
  rows.sort((a, b) => (a.section_id || '').localeCompare(b.section_id || '') || userName(a).localeCompare(userName(b)));
  $('view-users').innerHTML = `
    <div class="card"><div class="card-head"><h2>${L('কর্মী তালিকা', 'Users')}</h2><span class="sub">${L(nf(rows.length) + ' জন', rows.length + '')}</span><span class="spacer"></span>
      <button class="btn btn-sm" onclick="openManageSections()">⚙ ${L('সেকশন', 'Sections')}</button>
      <button class="btn btn-primary btn-sm" onclick="openUserModal()">+ ${L('নতুন কর্মী', 'New user')}</button></div>
      <div class="toolbar no-print">
        <input class="grow" type="search" placeholder="${L('খুঁজুন…', 'Search…')}" value="${esc(f.q)}" oninput="STATE.ui.userFilter.q=this.value;renderUsers()">
        <select onchange="STATE.ui.userFilter.sec=this.value;renderUsers()"><option value="">${L('সব সেকশন', 'All sections')}</option>${STATE.sections.map((s) => `<option value="${s.section_id}" ${s.section_id === f.sec ? 'selected' : ''}>${esc(sectionName(s))}</option>`).join('')}</select>
        <label class="check"><input type="checkbox" ${f.inactive ? 'checked' : ''} onchange="STATE.ui.userFilter.inactive=this.checked;renderUsers()"> ${L('নিষ্ক্রিয় দেখান', 'Show inactive')}</label>
      </div>
      <div class="table-wrap"><table><thead><tr><th>${L('নাম', 'Name')}</th><th>${L('পদবি', 'Designation')}</th><th>${L('সেকশন', 'Section')}</th><th>${L('অবস্থা', 'Status')}</th><th></th></tr></thead><tbody>
        ${rows.map((u) => `<tr><td>${esc(userName(u))}</td><td>${esc(u.designation || '—')}</td><td>${esc(sectionNameById(u.section_id))}</td><td>${isActive(u) ? `<span class="badge badge-ok">${L('সক্রিয়', 'active')}</span>` : `<span class="badge badge-void">${L('নিষ্ক্রিয়', 'inactive')}</span>`}</td><td><button class="btn btn-sm" onclick="openUserModal('${u.user_id}')">${L('সম্পাদনা', 'Edit')}</button></td></tr>`).join('')}
      </tbody></table></div></div>`;
}
window.openUserModal = function (userId) {
  requireWrite(() => {
    const u = userId ? userOf(userId) : null;
    modal(u ? L('কর্মী সম্পাদনা', 'Edit user') : L('নতুন কর্মী', 'New user'),
      `<div class="form-grid">
        <div class="field"><label>${L('নাম', 'Name')}</label><input type="text" id="usName" value="${esc(u ? u.name_bn : '')}"></div>
        <div class="field"><label>${L('পদবি', 'Designation')}</label><input type="text" id="usDesig" value="${esc(u ? u.designation : '')}" placeholder="${L('ঐচ্ছিক', 'optional')}"></div>
        <div class="field"><label>${L('সেকশন', 'Section')}</label><select id="usSec">${sectionOptions(u ? u.section_id : '')}</select></div>
        ${u ? `<label class="check"><input type="checkbox" id="usActive" ${isActive(u) ? 'checked' : ''}> ${L('সক্রিয়', 'Active')}</label>` : ''}
      </div>`,
      [{ label: L('সংরক্ষণ', 'Save'), primary: true, onClick: () => saveUser(userId) }, { label: L('বাতিল', 'Cancel'), onClick: closeModal }]);
  });
};
async function saveUser(userId) {
  const p = { name_bn: $('usName').value.trim(), designation: $('usDesig').value.trim(), section_id: $('usSec').value };
  if (!p.name_bn) return toast(L('নাম দিন', 'Enter a name'), 'err');
  let res;
  if (userId) { p.user_id = userId; if ($('usActive')) p.active = $('usActive').checked; res = await doWrite(API.updateUser(p), L('কর্মী হালনাগাদ হয়েছে', 'User updated')); }
  else res = await doWrite(API.addUser(p), L('কর্মী যোগ হয়েছে', 'User added'));
  if (res) { closeModal(); renderUsers(); }
}

/* ============================ VOID ============================ */
window.voidTxn = function (entity, txnId) {
  requireWrite(() => {
    modal(L('এন্ট্রি বাতিল', 'Void entry'), `<div class="field"><label>${L('কারণ', 'Reason')}</label><input type="text" id="voidReason" placeholder="${L('ঐচ্ছিক', 'optional')}"></div><p class="hint">${L('রেকর্ড মুছবে না — শুধু বাতিল হিসেবে চিহ্নিত হবে এবং ব্যালেন্স ঠিক হয়ে যাবে।', 'The record is kept (marked void); the balance corrects itself.')}</p>`,
      [{ label: L('বাতিল করুন', 'Void it'), danger: true, onClick: async () => { const r = await doWrite(API.voidEntry({ entity, txn_id: txnId, reason: ($('voidReason') || {}).value || '' }), L('বাতিল করা হয়েছে', 'Voided')); if (r) { closeModal(); renderView(); } } }, { label: L('না', 'Cancel'), onClick: closeModal }]);
  });
};

/* ============================ ISSUE SLIP ============================ */
window.showSlip = function (txnId) {
  const t = STATE.stockOut.find((x) => x.txn_id === txnId); if (!t) return;
  const it = itemOf(t.item_id);
  STATE.view = 'slip';
  document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const host = $('view-slip'); host.classList.add('active');
  host.innerHTML = `
    <div class="btn-row no-print" style="margin-bottom:12px"><button class="btn" onclick="switchView('stockout')">← ${L('ফিরে যান', 'Back')}</button><button class="btn btn-primary" onclick="window.print()">🖨 ${L('প্রিন্ট', 'Print')}</button></div>
    <div class="slip">
      <div class="slip-head"><h2>${esc(L(CFG.OFFICE_NAME_BN || STATE.meta.office_name_bn || '', CFG.OFFICE_NAME_EN || STATE.meta.office_name_en || ''))}</h2>
        <div class="sub">${esc(L(CFG.APP_TITLE_BN || '', CFG.APP_TITLE_EN || ''))}</div>
        <div class="doc">${L('মালামাল ইস্যু স্লিপ', 'STATIONERY ISSUE SLIP')}</div></div>
      <div class="slip-meta"><div><b>${L('স্লিপ নং', 'Slip No')}:</b> ${esc(t.slip_no || '')}</div><div><b>${L('তারিখ', 'Date')}:</b> ${dDate(t.date)}</div></div>
      <div class="slip-meta"><div><b>${L('গ্রহীতা', 'Received by')}:</b> ${esc(userNameById(t.user_id))}</div><div><b>${L('সেকশন', 'Section')}:</b> ${esc(sectionNameById(t.section_id))}</div></div>
      <div class="table-wrap"><table><thead><tr><th>${L('ক্রম', '#')}</th><th>${L('আইটেম', 'Item')}</th><th>${L('একক', 'Unit')}</th><th class="num">${L('পরিমাণ', 'Quantity')}</th></tr></thead>
        <tbody><tr><td>${nf(1)}</td><td>${esc(itemName(it))}</td><td>${unitLabel(it.unit)}</td><td class="num">${nf(t.qty)}</td></tr></tbody></table></div>
      <div class="slip-sign"><div>${L('ইস্যুকারীর স্বাক্ষর', 'Issuer signature')}</div><div>${L('গ্রহীতার স্বাক্ষর', 'Receiver signature')}</div></div>
    </div>`;
  window.scrollTo(0, 0);
};

/* ============================ REPORTS ============================ */
function filteredIn() { const r = STATE.ui.rep; return STATE.stockIn.filter((x) => !isVoid(x) && (!r.from || x.date >= r.from) && (!r.to || x.date <= r.to)); }
function filteredOut() { const r = STATE.ui.rep; return STATE.stockOut.filter((x) => !isVoid(x) && (!r.from || x.date >= r.from) && (!r.to || x.date <= r.to) && (!r.sec || x.section_id === r.sec) && (!r.user || x.user_id === r.user)); }
function repSummary() {
  const r = STATE.ui.rep, parts = [];
  if (r.from || r.to) parts.push((r.from ? dDate(r.from) : '…') + ' – ' + (r.to ? dDate(r.to) : '…'));
  if (r.sec && r.type !== 'in') parts.push(sectionNameById(r.sec));
  if (r.user && r.type !== 'in') parts.push(userNameById(r.user));
  return parts.length ? parts.join(' · ') : L('সব তথ্য', 'all data');
}
window.setRep = function (k, v) {
  STATE.ui.rep[k] = v;
  if (k === 'sec') { const u = userOf(STATE.ui.rep.user); if (u && v && u.section_id !== v) STATE.ui.rep.user = ''; }
  renderReports();
};
window.resetRep = function () { STATE.ui.rep = { type: STATE.ui.rep.type, from: '', to: '', sec: '', user: '' }; renderReports(); };

function renderReports() {
  const r = STATE.ui.rep;
  const typeBtn = (k, bn, en) => `<button class="btn btn-sm ${r.type === k ? 'btn-primary' : ''}" onclick="setRep('type','${k}')">${L(bn, en)}</button>`;
  const inDisabled = r.type === 'in';   // user/section don't apply to stock-in
  const secOpts = STATE.sections.map((s) => `<option value="${s.section_id}" ${r.sec === s.section_id ? 'selected' : ''}>${esc(sectionName(s))}</option>`).join('');
  const usrOpts = STATE.users.filter((u) => !r.sec || u.section_id === r.sec).sort((a, b) => userName(a).localeCompare(userName(b))).map((u) => `<option value="${u.user_id}" ${r.user === u.user_id ? 'selected' : ''}>${esc(userName(u))}</option>`).join('');
  let body = '';
  if (r.type === 'in') body = pivotReport(Compute.monthlyPivot(filteredIn()), L('মাসিক গ্রহণ', 'Monthly Received'), 'in');
  else if (r.type === 'out') body = pivotReport(Compute.monthlyPivot(filteredOut()), L('মাসিক বিতরণ', 'Monthly Issued'), 'out');
  else if (r.type === 'user') body = userWiseReport();
  else body = detailedReport();
  $('view-reports').innerHTML = `
    <div class="card"><div class="card-head"><h2>${L('রিপোর্ট', 'Reports')}</h2><span class="sub">${esc(repSummary())}</span><span class="spacer"></span><button class="btn btn-sm" onclick="window.print()">🖨 ${L('প্রিন্ট', 'Print')}</button></div>
      <div class="btn-row no-print" style="margin-bottom:10px">${typeBtn('in', 'মাসিক গ্রহণ', 'Monthly In')}${typeBtn('out', 'মাসিক বিতরণ', 'Monthly Out')}${typeBtn('user', 'কর্মী-ভিত্তিক', 'User-wise')}${typeBtn('detail', 'বিস্তারিত', 'Detailed')}</div>
      <div class="toolbar no-print">
        <div class="field" style="flex:0 0 auto"><label class="en">${L('শুরুর তারিখ', 'From')}</label><input type="date" value="${r.from}" onchange="setRep('from',this.value)"></div>
        <div class="field" style="flex:0 0 auto"><label class="en">${L('শেষ তারিখ', 'To')}</label><input type="date" value="${r.to}" onchange="setRep('to',this.value)"></div>
        <div class="field" style="flex:0 0 auto"><label class="en">${L('সেকশন', 'Section')}</label><select ${inDisabled ? 'disabled' : ''} onchange="setRep('sec',this.value)"><option value="">${L('সব সেকশন', 'All sections')}</option>${secOpts}</select></div>
        <div class="field" style="flex:0 0 auto"><label class="en">${L('কর্মী', 'User')}</label><select ${inDisabled ? 'disabled' : ''} onchange="setRep('user',this.value)"><option value="">${L('সব কর্মী', 'All users')}</option>${usrOpts}</select></div>
        <button class="btn btn-sm btn-ghost" onclick="resetRep()">↺ ${L('রিসেট', 'Reset')}</button>
      </div>
    </div>
    <div class="card">${body}</div>`;
}
function emptyReport(title) { return `<div class="card-head"><h2>${title}</h2></div><div class="empty">${L('এই ফিল্টারে কোনো তথ্য নেই', 'No data for this filter')}</div>`; }
function pivotReport(pivot, title, kind) {
  const months = pivot.months;
  if (!months.length) return emptyReport(title);
  const itemIds = Object.keys(pivot.items).sort((a, b) => itemNameById(a).localeCompare(itemNameById(b)));
  const head = `<tr><th>${L('আইটেম', 'Item')}</th>${months.map((m) => `<th class="num">${monthLabel(m)}</th>`).join('')}<th class="num">${L('মোট', 'Total')}</th></tr>`;
  const rows = itemIds.map((id) => `<tr><td>${esc(itemNameById(id))}</td>${months.map((m) => `<td class="num">${pivot.items[id].byMonth[m] ? nf(pivot.items[id].byMonth[m]) : '·'}</td>`).join('')}<td class="num"><b>${nf(pivot.items[id].total)}</b></td></tr>`).join('');
  const foot = `<tr><td><b>${L('মোট', 'Total')}</b></td>${months.map((m) => `<td class="num"><b>${nf(pivot.totalsByMonth[m] || 0)}</b></td>`).join('')}<td class="num"><b>${nf(pivot.grand)}</b></td></tr>`;
  return `<div class="card-head"><h2>${title}</h2><span class="spacer"></span><button class="btn btn-sm no-print" onclick="exportPivotCSV('${kind}')">⬇ CSV</button></div>
    <div class="table-wrap"><table><thead>${head}</thead><tbody>${rows}</tbody><tfoot>${foot}</tfoot></table></div>`;
}
function userWiseReport() {
  const rows = filteredOut();
  const uw = Compute.userWiseOut(rows);
  const itemIds = [...new Set(rows.map((r) => r.item_id))].sort((a, b) => itemNameById(a).localeCompare(itemNameById(b)));
  if (!itemIds.length) return emptyReport(L('কর্মী-ভিত্তিক বিতরণ', 'User-wise Issued'));
  const bySec = {};
  Object.keys(uw).forEach((uid) => { const u = userOf(uid); const sec = u ? (u.section_id || '(unknown)') : '(unknown)'; (bySec[sec] = bySec[sec] || []).push(uid); });
  const order = STATE.sections.map((s) => s.section_id).concat(Object.keys(bySec).filter((k) => !STATE.sectionById.has(k)));
  const head = `<tr><th>${L('কর্মী / সেকশন', 'User / Section')}</th>${itemIds.map((id) => `<th class="num">${esc(itemNameById(id))}</th>`).join('')}<th class="num">${L('মোট', 'Total')}</th></tr>`;
  let bodyRows = '';
  order.forEach((secId) => {
    const uids = bySec[secId]; if (!uids || !uids.length) return;
    bodyRows += `<tr style="background:var(--accent)"><td colspan="${itemIds.length + 2}"><b>${esc(sectionNameById(secId))}</b></td></tr>`;
    const secTot = {};
    uids.map((id) => userOf(id)).filter(Boolean).sort((a, b) => userName(a).localeCompare(userName(b))).forEach((u) => {
      const g = uw[u.user_id];
      bodyRows += `<tr><td>${esc(userName(u))}</td>${itemIds.map((id) => { const q = g.byItem[id] || 0; secTot[id] = (secTot[id] || 0) + q; return `<td class="num">${q ? nf(q) : '·'}</td>`; }).join('')}<td class="num"><b>${nf(g.total)}</b></td></tr>`;
    });
    bodyRows += `<tr><td class="muted">${L('উপমোট', 'Subtotal')}</td>${itemIds.map((id) => `<td class="num">${secTot[id] ? nf(secTot[id]) : '·'}</td>`).join('')}<td class="num"><b>${nf(Object.values(secTot).reduce((a, b) => a + b, 0))}</b></td></tr>`;
  });
  return `<div class="card-head"><h2>${L('কর্মী-ভিত্তিক বিতরণ', 'User-wise Issued')}</h2><span class="spacer"></span><button class="btn btn-sm no-print" onclick="exportUserWiseCSV()">⬇ CSV</button></div>
    <div class="table-wrap"><table><thead>${head}</thead><tbody>${bodyRows}</tbody></table></div>`;
}
function detailedReport() {
  const rows = filteredOut().slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (!rows.length) return emptyReport(L('বিস্তারিত বিতরণ', 'Detailed issues'));
  const total = rows.reduce((s, r) => s + Compute.num(r.qty), 0);
  return `<div class="card-head"><h2>${L('বিস্তারিত বিতরণ', 'Detailed issues')}</h2><span class="sub">${nf(rows.length)} ${L('এন্ট্রি', 'entries')}</span><span class="spacer"></span><button class="btn btn-sm no-print" onclick="exportDetailCSV()">⬇ CSV</button></div>
    <div class="table-wrap"><table><thead><tr><th>${L('তারিখ', 'Date')}</th><th>${L('স্লিপ', 'Slip')}</th><th>${L('কর্মী', 'User')}</th><th>${L('সেকশন', 'Section')}</th><th>${L('আইটেম', 'Item')}</th><th class="num">${L('পরিমাণ', 'Qty')}</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${dDate(r.date)}</td><td>${esc(r.slip_no || '')}</td><td>${esc(userNameById(r.user_id))}</td><td>${esc(sectionNameById(r.section_id))}</td><td>${esc(itemNameById(r.item_id))}</td><td class="num">${nf(r.qty)} ${unitLabel((itemOf(r.item_id) || {}).unit)}</td></tr>`).join('')}
    </tbody><tfoot><tr><td colspan="5"><b>${L('মোট', 'Total')}</b></td><td class="num"><b>${nf(total)}</b></td></tr></tfoot></table></div>`;
}
window.exportPivotCSV = function (kind) {
  const pivot = Compute.monthlyPivot(kind === 'in' ? filteredIn() : filteredOut());
  const head = ['item', ...pivot.months, 'total'];
  const lines = Object.keys(pivot.items).map((id) => [itemNameById(id), ...pivot.months.map((m) => pivot.items[id].byMonth[m] || 0), pivot.items[id].total]);
  downloadCSV('monthly_' + kind + '.csv', head, lines);
};
window.exportUserWiseCSV = function () {
  const rows = filteredOut(), uw = Compute.userWiseOut(rows);
  const itemIds = [...new Set(rows.map((r) => r.item_id))];
  const head = ['user', 'section', ...itemIds.map(itemNameById), 'total'];
  const lines = Object.keys(uw).map((uid) => { const u = userOf(uid); return [u ? userName(u) : uid, u ? sectionNameById(u.section_id) : '', ...itemIds.map((id) => uw[uid].byItem[id] || 0), uw[uid].total]; });
  downloadCSV('user_wise.csv', head, lines);
};
window.exportDetailCSV = function () {
  const rows = filteredOut().slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const head = ['date', 'slip', 'user', 'section', 'item', 'qty', 'unit'];
  const lines = rows.map((r) => [r.date, r.slip_no || '', userNameById(r.user_id), sectionNameById(r.section_id), itemNameById(r.item_id), r.qty, (itemOf(r.item_id) || {}).unit || '']);
  downloadCSV('detailed_issues.csv', head, lines);
};

/* ============================ CSV download ============================ */
function downloadCSV(filename, header, rows) {
  const q = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = '﻿' + [header, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename; a.click(); URL.revokeObjectURL(a.href);
  toast(L('ফাইল ডাউনলোড হয়েছে', 'File downloaded'), 'ok');
}

/* ============================ MANAGE LISTS (units / sections) ============================ */
function sectionOptions(selectedId) {
  return STATE.sections.filter((s) => isActive(s) || s.section_id === selectedId)
    .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
    .map((s) => `<option value="${s.section_id}" ${s.section_id === selectedId ? 'selected' : ''}>${esc(sectionName(s))}</option>`).join('');
}

/* ---- units (stored as a JSON list in Meta.units; codes are stable) ---- */
window.openManageUnits = function () {
  requireWrite(() => {
    const rowHtml = (u) => `<div class="form-grid two urow" style="gap:8px;margin-bottom:8px">
        <input type="text" class="u-bn" data-code="${esc(u ? u.code : '')}" value="${esc(u ? u.bn : '')}" placeholder="${L('বাংলা নাম', 'Bengali')}">
        <input type="text" class="u-en" value="${esc(u ? u.en : '')}" placeholder="${L('ইংরেজি নাম', 'English')}"></div>`;
    modal(L('একক ব্যবস্থাপনা', 'Manage units'),
      `<p class="hint">${L('একক যোগ বা সম্পাদনা করুন। খালি ঘর বাদ যাবে; বিদ্যমান এককের কোড অপরিবর্তিত থাকে।', 'Add or edit units. Blank rows are skipped; existing codes stay fixed.')}</p>
       <div id="unitRows">${getUnits().map(rowHtml).join('')}${rowHtml(null)}</div>
       <button class="btn btn-sm" id="addUnitRow">+ ${L('আরেকটি', 'Add row')}</button>`,
      [{ label: L('সংরক্ষণ', 'Save'), primary: true, onClick: saveUnits }, { label: L('বাতিল', 'Cancel'), onClick: closeModal }]);
    setTimeout(() => { const b = $('addUnitRow'); if (b) b.addEventListener('click', () => { $('unitRows').insertAdjacentHTML('beforeend', rowHtml(null)); }); }, 20);
  });
};
async function saveUnits() {
  const used = {}, list = [];
  document.querySelectorAll('#unitRows .urow').forEach((r) => {
    const bn = r.querySelector('.u-bn').value.trim(), en = r.querySelector('.u-en').value.trim();
    if (!bn && !en) return;
    let code = r.querySelector('.u-bn').dataset.code || slug(en || bn) || 'unit';
    const base = code; let k = 1; while (used[code]) code = base + '-' + (++k); used[code] = 1;
    list.push({ code, bn: bn || en, en: en || bn });
  });
  if (!list.length) return toast(L('অন্তত একটি একক দিন', 'Add at least one unit'), 'err');
  const res = await doWrite(API.setMeta({ key: 'units', value: JSON.stringify(list) }), L('একক হালনাগাদ হয়েছে', 'Units updated'));
  if (res) { closeModal(); renderView(); }
}

/* ---- sections (real entity: addSection / updateSection) ---- */
window.openManageSections = function () {
  requireWrite(() => {
    modal(L('সেকশন ব্যবস্থাপনা', 'Manage sections'),
      `<div class="list">${STATE.sections.slice().sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)).map((s) => `<div class="list-item"><span class="name">${esc(s.name_bn)}${s.name_en ? ` <span class="tag">${esc(s.name_en)}</span>` : ''}</span>${isActive(s) ? '' : `<span class="badge badge-void">${L('নিষ্ক্রিয়', 'inactive')}</span>`}<button class="btn btn-sm" onclick="openSectionForm('${s.section_id}')">${L('সম্পাদনা', 'Edit')}</button></div>`).join('')}</div>
       <div class="btn-row" style="margin-top:12px"><button class="btn btn-primary btn-sm" onclick="openSectionForm()">+ ${L('নতুন সেকশন', 'New section')}</button></div>`,
      [{ label: L('বন্ধ', 'Close'), onClick: closeModal }]);
  });
};
window.openSectionForm = function (id) {
  const s = id ? sectionOf(id) : null;
  modal(s ? L('সেকশন সম্পাদনা', 'Edit section') : L('নতুন সেকশন', 'New section'),
    `<div class="form-grid">
       <div class="field"><label>${L('নাম (বাংলা)', 'Name (Bengali)')}</label><input type="text" id="secBn" value="${esc(s ? s.name_bn : '')}"></div>
       <div class="field"><label>${L('নাম (ইংরেজি)', 'Name (English)')}</label><input type="text" id="secEn" value="${esc(s ? s.name_en : '')}" placeholder="${L('ঐচ্ছিক', 'optional')}"></div>
       ${s ? `<label class="check"><input type="checkbox" id="secActive" ${isActive(s) ? 'checked' : ''}> ${L('সক্রিয়', 'Active')}</label>` : ''}
     </div>`,
    [{ label: L('সংরক্ষণ', 'Save'), primary: true, onClick: () => saveSection(id) }, { label: L('← ফিরে', 'Back'), onClick: () => openManageSections() }]);
};
async function saveSection(id) {
  const p = { name_bn: $('secBn').value.trim(), name_en: $('secEn').value.trim() };
  if (!p.name_bn) return toast(L('নাম দিন', 'Enter a name'), 'err');
  let res;
  if (id) { p.section_id = id; if ($('secActive')) p.active = $('secActive').checked; res = await doWrite(API.updateSection(p), L('সেকশন হালনাগাদ হয়েছে', 'Section updated')); }
  else res = await doWrite(API.addSection(p), L('সেকশন যোগ হয়েছে', 'Section added'));
  if (res) openManageSections();
}

/* ============================ REQUIREMENTS / PROCUREMENT CYCLES ============================ */
const openCycles = () => STATE.cycles.filter((c) => String(c.status || 'open').toLowerCase() !== 'closed');
function cycleById(id) { return STATE.cycles.find((c) => c.cycle_id === id); }
function cycleLabel(c) { return c ? (c.name + (String(c.status).toLowerCase() === 'closed' ? ' (' + L('বন্ধ', 'closed') + ')' : '')) : '—'; }
function ensureReqCycle() {
  if (STATE.ui.req.cycleId && cycleById(STATE.ui.req.cycleId)) return;
  STATE.ui.req.cycleId = ((openCycles()[0] || STATE.cycles[0] || {}).cycle_id) || '';
}
function cycleOptions(selectedId) { return STATE.cycles.map((c) => `<option value="${c.cycle_id}" ${c.cycle_id === selectedId ? 'selected' : ''}>${esc(cycleLabel(c))}</option>`).join(''); }
// cycle dropdown for the Stock Out form: a "no cycle" option + cycles, defaulting to the open one
function cycleSelectForOut() {
  const def = (openCycles()[0] || {}).cycle_id || '';
  return `<option value="">${L('— চক্র ছাড়া —', '— no cycle —')}</option>` + STATE.cycles.map((c) => `<option value="${c.cycle_id}" ${c.cycle_id === def ? 'selected' : ''}>${esc(cycleLabel(c))}</option>`).join('');
}
window.setReqTab = function (k) { STATE.ui.req.tab = k; renderRequirements(); };
window.setReqCycle = function (v) { STATE.ui.req.cycleId = v; renderRequirements(); };
window.setReqScope = function (scope) { STATE.ui.req.scope = scope; STATE.ui.req.scopeId = ''; renderRequirements(); };
window.setReqScopeId = function (v) { STATE.ui.req.scopeId = v; renderRequirements(); };

function renderRequirements() {
  ensureReqCycle();
  const host = $('view-requirements'), r = STATE.ui.req;
  if (!STATE.cycles.length) {
    host.innerHTML = `<div class="card"><div class="card-head"><h2>${L('চাহিদা ও ক্রয় চক্র', 'Requirements & purchase cycles')}</h2></div>
      <div class="empty">${L('এখনো কোনো ক্রয় চক্র তৈরি হয়নি। প্রতি ৩–৪ মাসে একটি চক্র খুলুন, সেকশনভিত্তিক চাহিদা যোগ করুন, একত্রিত এস্টিমেট দেখে ক্রয় করুন।', 'No purchase cycle yet. Open one every 3–4 months, add requirements per section, then buy from the consolidated estimate.')}<br><br><button class="btn btn-primary" onclick="openCycleForm()">+ ${L('নতুন চক্র তৈরি করুন', 'Create a cycle')}</button></div></div>`;
    return;
  }
  const subBtn = (k, bn, en) => `<button class="btn btn-sm ${r.tab === k ? 'btn-primary' : ''}" onclick="setReqTab('${k}')">${L(bn, en)}</button>`;
  const cyc = cycleById(r.cycleId);
  const body = r.tab === 'estimate' ? reqEstimate() : r.tab === 'usage' ? reqUsage() : reqEntry();
  host.innerHTML = `
    <div class="card"><div class="card-head"><h2>${L('চাহিদা ও ক্রয় চক্র', 'Requirements & purchase cycle')}</h2><span class="spacer"></span>
      <button class="btn btn-sm" onclick="openManageCycles()">⚙ ${L('চক্র', 'Cycles')}</button></div>
      <div class="toolbar">
        <div class="field grow"><label class="en">${L('ক্রয় চক্র', 'Purchase cycle')}</label><select onchange="setReqCycle(this.value)">${cycleOptions(r.cycleId)}</select></div>
        ${cyc ? `<div class="hint">${cyc.start_date ? dDate(cyc.start_date) : '…'} – ${cyc.end_date ? dDate(cyc.end_date) : '…'} · ${String(cyc.status).toLowerCase() === 'closed' ? L('বন্ধ', 'closed') : L('চলমান', 'open')}</div>` : ''}
      </div>
      <div class="btn-row no-print">${subBtn('entry', 'চাহিদা এন্ট্রি', 'Entry')}${subBtn('estimate', 'একত্রিত এস্টিমেট', 'Estimate')}${subBtn('usage', 'ব্যবহার ট্র্যাকিং', 'Usage')}</div>
    </div>
    <div class="card">${body}</div>`;
}

function reqScopeControls() {
  const r = STATE.ui.req;
  const btns = `<div class="btn-row" style="margin-bottom:0"><button class="btn btn-sm ${r.scope === 'section' ? 'btn-primary' : ''}" onclick="setReqScope('section')">${L('সেকশন', 'Section')}</button><button class="btn btn-sm ${r.scope === 'user' ? 'btn-primary' : ''}" onclick="setReqScope('user')">${L('কর্মী', 'User')}</button></div>`;
  const sel = r.scope === 'section'
    ? `<select onchange="setReqScopeId(this.value)"><option value="">${L('— সেকশন বাছুন —', '— pick section —')}</option>${STATE.sections.map((s) => `<option value="${s.section_id}" ${r.scopeId === s.section_id ? 'selected' : ''}>${esc(sectionName(s))}</option>`).join('')}</select>`
    : `<select onchange="setReqScopeId(this.value)"><option value="">${L('— কর্মী বাছুন —', '— pick user —')}</option>${STATE.users.filter(isActive).sort((a, b) => userName(a).localeCompare(userName(b))).map((u) => `<option value="${u.user_id}" ${r.scopeId === u.user_id ? 'selected' : ''}>${esc(userName(u))} — ${esc(sectionNameById(u.section_id))}</option>`).join('')}</select>`;
  return `<div class="toolbar">${btns}<div class="field grow">${sel}</div></div>`;
}

function reqEntry() {
  const r = STATE.ui.req, controls = reqScopeControls();
  if (!r.scopeId) return `<div class="card-head"><h2>${L('চাহিদা এন্ট্রি', 'Requirement entry')}</h2></div>${controls}<div class="empty">${L('উপরে একটি সেকশন বা কর্মী বাছুন, তারপর তাদের চাহিদা যোগ করুন।', 'Pick a section or user above, then add their requirements.')}</div>`;
  const lines = STATE.requirements.filter((x) => x.cycle_id === r.cycleId && x.scope === r.scope && x.scope_id === r.scopeId && Number(x.qty) > 0).sort((a, b) => itemNameById(a.item_id).localeCompare(itemNameById(b.item_id)));
  const scopeName = r.scope === 'section' ? sectionNameById(r.scopeId) : userNameById(r.scopeId);
  return `<div class="card-head"><h2>${L('চাহিদা এন্ট্রি', 'Requirement entry')}</h2><span class="sub">${esc(scopeName)}</span></div>
    ${controls}
    <div class="form-grid two" style="align-items:end;margin-top:6px">
      <div class="field"><label>${L('আইটেম', 'Item')}</label><select id="reqItem">${itemOptions()}</select></div>
      <div class="field"><label>${L('চাহিদার পরিমাণ', 'Required qty')}</label><div style="display:flex;gap:8px"><input type="number" id="reqQty" min="0" step="1" placeholder="0" style="flex:1"><button class="btn btn-primary" onclick="addReqLine()">${L('সেট', 'Set')}</button></div></div>
    </div>
    <div class="table-wrap" style="margin-top:12px">${lines.length ? `<table><thead><tr><th>${L('আইটেম', 'Item')}</th><th class="num">${L('চাহিদা', 'Required')}</th><th></th></tr></thead><tbody>
      ${lines.map((x) => `<tr><td>${esc(itemNameById(x.item_id))}</td><td class="num">${nf(x.qty)} ${unitLabel((itemOf(x.item_id) || {}).unit)}</td><td class="t-actions"><button class="btn btn-sm" onclick="editReqLine('${x.item_id}',${Number(x.qty)})">${L('সম্পাদনা', 'Edit')}</button><button class="btn btn-sm btn-danger" onclick="removeReqLine('${x.item_id}')">${L('মুছুন', 'Remove')}</button></td></tr>`).join('')}
    </tbody></table>` : `<div class="empty">${L('এই তালিকায় এখনো কিছু নেই।', 'Nothing on this list yet.')}</div>`}</div>`;
}
window.addReqLine = function () {
  const r = STATE.ui.req, item_id = $('reqItem').value, qty = enNum($('reqQty').value);
  if (!item_id) return toast(L('আইটেম বাছুন', 'Pick an item'), 'err');
  if (!(qty > 0)) return toast(L('পরিমাণ লিখুন', 'Enter a quantity'), 'err');
  requireWrite(async () => { await doWrite(API.setRequirement({ cycle_id: r.cycleId, scope: r.scope, scope_id: r.scopeId, item_id, qty }), L('চাহিদা সংরক্ষিত', 'Requirement saved')); });
};
window.editReqLine = function (itemId, qty) { const s = $('reqItem'); if (s) s.value = itemId; const q = $('reqQty'); if (q) { q.value = qty; q.focus(); } };
window.removeReqLine = function (itemId) {
  const r = STATE.ui.req;
  requireWrite(async () => { await doWrite(API.setRequirement({ cycle_id: r.cycleId, scope: r.scope, scope_id: r.scopeId, item_id: itemId, qty: 0 }), L('সরানো হয়েছে', 'Removed')); });
};

function reqEstimate() {
  const est = Compute.consolidatedEstimate(STATE, STATE.ui.req.cycleId).sort((a, b) => itemNameById(a.item_id).localeCompare(itemNameById(b.item_id)));
  if (!est.length) return `<div class="card-head"><h2>${L('একত্রিত ক্রয় এস্টিমেট', 'Consolidated purchase estimate')}</h2></div><div class="empty">${L('এই চক্রে এখনো কোনো চাহিদা যোগ করা হয়নি।', 'No requirements entered for this cycle yet.')}</div>`;
  return `<div class="card-head"><h2>${L('একত্রিত ক্রয় এস্টিমেট', 'Consolidated purchase estimate')}</h2><span class="sub">${L('সব সেকশনের চাহিদা একত্রে', 'all sections combined')}</span><span class="spacer"></span><button class="btn btn-sm no-print" onclick="exportEstimateCSV()">⬇ CSV</button><button class="btn btn-sm" onclick="window.print()">🖨 ${L('প্রিন্ট', 'Print')}</button></div>
    <div class="table-wrap"><table><thead><tr><th>${L('আইটেম', 'Item')}</th><th>${L('একক', 'Unit')}</th><th class="num">${L('মোট চাহিদা', 'Required')}</th><th class="num">${L('বর্তমান স্টক', 'On hand')}</th><th class="num">${L('ক্রয় করতে হবে', 'To buy')}</th></tr></thead><tbody>
      ${est.map((e) => `<tr class="${e.toBuy > 0 ? 'low' : ''}"><td>${esc(itemNameById(e.item_id))}</td><td>${unitLabel((itemOf(e.item_id) || {}).unit)}</td><td class="num">${nf(e.required)}</td><td class="num">${nf(e.onHand)}</td><td class="num"><b>${nf(e.toBuy)}</b></td></tr>`).join('')}
    </tbody></table></div>`;
}
window.exportEstimateCSV = function () {
  const est = Compute.consolidatedEstimate(STATE, STATE.ui.req.cycleId);
  downloadCSV('purchase_estimate.csv', ['item', 'unit', 'required', 'on_hand', 'to_buy'], est.map((e) => [itemNameById(e.item_id), (itemOf(e.item_id) || {}).unit || '', e.required, e.onHand, e.toBuy]));
};

function reqUsage() {
  const r = STATE.ui.req, controls = reqScopeControls();
  if (!r.scopeId) return `<div class="card-head"><h2>${L('ব্যবহার বনাম সীমা', 'Usage vs limit')}</h2></div>${controls}<div class="empty">${L('উপরে একটি সেকশন বা কর্মী বাছুন।', 'Pick a section or user above.')}</div>`;
  const rows = Compute.usageVsRequirement(STATE, r.cycleId, r.scope, r.scopeId).sort((a, b) => itemNameById(a.item_id).localeCompare(itemNameById(b.item_id)));
  const scopeName = r.scope === 'section' ? sectionNameById(r.scopeId) : userNameById(r.scopeId);
  const headerRow = `<div class="card-head"><h2>${L('ব্যবহার বনাম সীমা', 'Usage vs limit')}</h2><span class="sub">${esc(scopeName)}</span><span class="spacer"></span><button class="btn btn-sm no-print" onclick="exportUsageCSV()">⬇ CSV</button><button class="btn btn-sm" onclick="window.print()">🖨 ${L('প্রিন্ট', 'Print')}</button></div>`;
  if (!rows.length) return `${headerRow}${controls}<div class="empty">${L('এই চক্রে কোনো চাহিদা বা বিতরণ নেই।', 'No requirement or issue in this cycle.')}</div>`;
  return `${headerRow}${controls}
    <div class="table-wrap"><table><thead><tr><th>${L('আইটেম', 'Item')}</th><th class="num">${L('চাহিদা (সীমা)', 'Limit')}</th><th class="num">${L('বিতরণ', 'Issued')}</th><th class="num">${L('বাকি', 'Remaining')}</th><th>${L('অবস্থা', 'Status')}</th></tr></thead><tbody>
      ${rows.map((x) => `<tr class="${x.over ? 'low' : ''}"><td>${esc(itemNameById(x.item_id))}</td><td class="num">${x.required ? nf(x.required) : '—'}</td><td class="num">${nf(x.issued)}</td><td class="num"><b class="${x.remaining < 0 ? 'badge badge-neg' : ''}">${nf(x.remaining)}</b></td><td>${x.over ? `<span class="badge badge-low">${L('সীমা ছাড়িয়েছে', 'over limit')}</span>` : (x.required ? `<span class="badge badge-ok">${L('সীমার মধ্যে', 'within')}</span>` : '<span class="muted">—</span>')}</td></tr>`).join('')}
    </tbody></table></div>`;
}
window.exportUsageCSV = function () {
  const r = STATE.ui.req, rows = Compute.usageVsRequirement(STATE, r.cycleId, r.scope, r.scopeId);
  downloadCSV('usage_vs_limit.csv', ['item', 'limit', 'issued', 'remaining', 'over'], rows.map((x) => [itemNameById(x.item_id), x.required, x.issued, x.remaining, x.over ? 'YES' : '']));
};

window.openManageCycles = function () {
  requireWrite(() => {
    modal(L('ক্রয় চক্র ব্যবস্থাপনা', 'Manage cycles'),
      `<div class="list">${STATE.cycles.length ? STATE.cycles.map((c) => `<div class="list-item"><span class="name">${esc(c.name)}<div class="meta">${c.start_date ? dDate(c.start_date) : '…'} – ${c.end_date ? dDate(c.end_date) : '…'}</div></span>${String(c.status).toLowerCase() === 'closed' ? `<span class="badge badge-void">${L('বন্ধ', 'closed')}</span>` : `<span class="badge badge-ok">${L('চলমান', 'open')}</span>`}<button class="btn btn-sm" onclick="openCycleForm('${c.cycle_id}')">${L('সম্পাদনা', 'Edit')}</button></div>`).join('') : `<div class="empty">${L('কোনো চক্র নেই', 'No cycles')}</div>`}</div>
       <div class="btn-row" style="margin-top:12px"><button class="btn btn-primary btn-sm" onclick="openCycleForm()">+ ${L('নতুন চক্র', 'New cycle')}</button></div>`,
      [{ label: L('বন্ধ', 'Close'), onClick: closeModal }]);
  });
};
window.openCycleForm = function (id) {
  requireWrite(() => {
    const c = id ? cycleById(id) : null;
    modal(c ? L('চক্র সম্পাদনা', 'Edit cycle') : L('নতুন ক্রয় চক্র', 'New purchase cycle'),
      `<div class="form-grid">
         <div class="field"><label>${L('চক্রের নাম', 'Cycle name')}</label><input type="text" id="cyName" value="${esc(c ? c.name : '')}" placeholder="${L('যেমন: জুলাই–অক্টোবর ২০২৬', 'e.g. Jul–Oct 2026')}"></div>
         <div class="form-grid two" style="gap:14px">
           <div class="field"><label>${L('শুরু', 'Start')}</label><input type="date" id="cyStart" value="${esc(c ? String(c.start_date || '').slice(0, 10) : '')}"></div>
           <div class="field"><label>${L('শেষ', 'End')}</label><input type="date" id="cyEnd" value="${esc(c ? String(c.end_date || '').slice(0, 10) : '')}"></div>
         </div>
         ${c ? `<div class="field"><label>${L('অবস্থা', 'Status')}</label><select id="cyStatus"><option value="open" ${String(c.status).toLowerCase() !== 'closed' ? 'selected' : ''}>${L('চলমান', 'Open')}</option><option value="closed" ${String(c.status).toLowerCase() === 'closed' ? 'selected' : ''}>${L('বন্ধ', 'Closed')}</option></select></div>` : ''}
       </div>`,
      [{ label: L('সংরক্ষণ', 'Save'), primary: true, onClick: () => saveCycle(id) }, { label: c ? L('← ফিরে', 'Back') : L('বাতিল', 'Cancel'), onClick: c ? openManageCycles : closeModal }]);
  });
};
async function saveCycle(id) {
  const p = { name: $('cyName').value.trim(), start_date: $('cyStart').value, end_date: $('cyEnd').value };
  if (!p.name) return toast(L('নাম দিন', 'Enter a name'), 'err');
  let res;
  if (id) { p.cycle_id = id; if ($('cyStatus')) p.status = $('cyStatus').value; res = await doWrite(API.updateCycle(p), L('চক্র হালনাগাদ হয়েছে', 'Cycle updated')); }
  else res = await doWrite(API.addCycle(p), L('চক্র তৈরি হয়েছে', 'Cycle created'));
  if (res) { if (res.data && res.data.cycle) STATE.ui.req.cycleId = res.data.cycle.cycle_id; closeModal(); switchView('requirements'); renderRequirements(); }
}

/* ============================ IMPORT (file → bulk Stock In) ============================ */
let _imp = null;   // last parsed/resolved import

function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error('load failed: ' + src)); document.head.appendChild(s); }); }
async function ensureXlsx() { if (!window.XLSX) await loadScript('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'); }
async function ensurePdfjs() { if (!window.pdfjsLib) { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'); if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; } }

// reconstruct text lines from PDF.js text items by their y-position
function pdfItemsToLines(items) {
  const byY = {};
  items.forEach((it) => { const y = Math.round(it.transform[5]); (byY[y] = byY[y] || []).push(it); });
  return Object.keys(byY).map(Number).sort((a, b) => b - a)
    .map((y) => byY[y].sort((a, b) => a.transform[4] - b.transform[4]).map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean).join('\n');
}

async function fileToGrid(file) {
  const name = (file.name || '').toLowerCase();
  const buf = await file.arrayBuffer();
  if (name.endsWith('.pdf')) {
    await ensurePdfjs();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let text = '';
    for (let p = 1; p <= pdf.numPages; p++) { const page = await pdf.getPage(p); const tc = await page.getTextContent(); text += pdfItemsToLines(tc.items) + '\n'; }
    return Parse.parsePdfText(text);
  }
  await ensureXlsx();
  const wb = XLSX.read(buf, { type: 'array' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false, defval: '' });
}

window.downloadImportTemplate = function () {
  const lines = STATE.items.filter(isActive).sort((a, b) => itemName(a).localeCompare(itemName(b))).map((i) => [i.item_id, i.name_en || i.name_bn, i.unit, '', '']);
  downloadCSV('stock_in_template.csv', ['item_id', 'item', 'unit', 'quantity', 'remarks'], lines);
};

window.openImport = function () {
  modal(L('ফাইল থেকে আমদানি', 'Import from file'),
    `<div class="field"><label>${L('Excel/CSV বা PDF ফাইল', 'Excel/CSV or PDF file')}</label>
       <input type="file" id="impFile" accept=".xlsx,.xls,.csv,.pdf"></div>
     <p class="hint">${L('আইটেমের নাম ও পরিমাণ আছে এমন ফাইল দিন। আমাদের টেমপ্লেট ব্যবহার করলে মিল নিখুঁত হয়। PDF অবশ্যই লেখা-নির্বাচনযোগ্য হতে হবে (স্ক্যান নয়)।', 'Upload a file with item names and quantities. Our template gives exact matches. PDFs must have selectable text (not scans).')}</p>
     <div id="impStatus" class="hint"></div>`,
    [{ label: L('বাতিল', 'Cancel'), onClick: closeModal }]);
  setTimeout(() => { const f = $('impFile'); if (f) f.addEventListener('change', onImportFile); }, 20);
};

async function onImportFile(e) {
  const file = e.target.files && e.target.files[0]; if (!file) return;
  const st = $('impStatus'); if (st) { st.textContent = L('পড়া হচ্ছে…', 'Reading…'); st.className = 'hint'; }
  try {
    const grid = await fileToGrid(file);
    const resolved = Parse.resolveRows(grid, STATE.items);
    if (!resolved.rows.length) { if (st) { st.textContent = L('কোনো সারি পাওয়া যায়নি — কলাম/ফরম্যাট দেখুন বা টেমপ্লেট ব্যবহার করুন।', 'No rows found — check the columns/format or use the template.'); st.className = 'hint bad'; } return; }
    _imp = resolved;
    renderImportReview();
  } catch (err) { if (st) { st.textContent = L('ফাইল পড়া যায়নি: ', 'Could not read file: ') + (err.message || err); st.className = 'hint bad'; } }
}

function renderImportReview() {
  const rows = _imp.rows;
  const matched = rows.filter((r) => r.status !== 'unmatched').length;
  const opts = (sel) => `<option value="">${L('— বাছুন —', '— pick —')}</option>` + STATE.items.filter(isActive).slice().sort((a, b) => itemName(a).localeCompare(itemName(b))).map((i) => `<option value="${i.item_id}" ${i.item_id === sel ? 'selected' : ''}>${esc(itemName(i))}</option>`).join('');
  const body = `
    <div class="form-grid two">
      <div class="field"><label>${L('গ্রহণের তারিখ', 'Date')}</label><input type="date" id="impDate" value="${todayISO()}"></div>
      <div class="field"><label>${L('মন্তব্য (সব সারিতে)', 'Remarks (all rows)')}</label><input type="text" id="impRemarks" placeholder="${L('ঐচ্ছিক', 'optional')}"></div>
    </div>
    <p class="hint">${nf(rows.length)} ${L('সারি', 'rows')} · ${nf(matched)} ${L('মিলেছে', 'matched')} · ${L('বাকিগুলো বাছুন বা টিক তুলে বাদ দিন', 'pick or untick the rest')}</p>
    <div class="table-wrap" style="max-height:46vh;overflow:auto"><table><thead><tr><th></th><th>${L('ফাইলের নাম', 'From file')}</th><th>${L('আইটেম', 'Item')}</th><th class="num">${L('পরিমাণ', 'Qty')}</th><th>${L('অবস্থা', 'Status')}</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr>
        <td><input type="checkbox" class="imp-skip" data-i="${i}" ${(r.status === 'unmatched' && !r.item_id) ? '' : 'checked'}></td>
        <td>${esc(r.rawName || r.rawId)}</td>
        <td><select class="imp-item" data-i="${i}">${opts(r.item_id)}</select></td>
        <td><input type="number" class="imp-qty" data-i="${i}" min="0" step="1" value="${r.qty || ''}" style="width:84px"></td>
        <td>${r.status === 'matched' ? `<span class="badge badge-ok">${L('মিল', 'match')}</span>` : r.status === 'fuzzy' ? `<span class="badge badge-low">${L('সম্ভাব্য', 'guess')}</span>` : `<span class="badge badge-neg">${L('মিল নেই', 'no match')}</span>`}</td>
      </tr>`).join('')}
    </tbody></table></div>`;
  modal(L('আমদানি পর্যালোচনা', 'Review import'), body,
    [{ label: L('আমদানি করুন', 'Import'), primary: true, onClick: confirmImport }, { label: L('বাতিল', 'Cancel'), onClick: closeModal }]);
  const m = document.querySelector('#modalOverlay .modal'); if (m) m.style.maxWidth = '780px';
  // picking an item for a row auto-includes it
  setTimeout(() => { document.querySelectorAll('.imp-item').forEach((s) => s.addEventListener('change', () => { const cb = document.querySelector('.imp-skip[data-i="' + s.dataset.i + '"]'); if (cb && s.value) cb.checked = true; })); }, 20);
}

async function confirmImport() {
  const date = $('impDate').value || todayISO(), remarks = $('impRemarks').value.trim();
  const skip = {}, item = {}, qty = {};
  document.querySelectorAll('.imp-skip').forEach((c) => { skip[c.dataset.i] = !c.checked; });
  document.querySelectorAll('.imp-item').forEach((s) => { item[s.dataset.i] = s.value; });
  document.querySelectorAll('.imp-qty').forEach((q) => { qty[q.dataset.i] = enNum(q.value); });
  const rows = [];
  _imp.rows.forEach((r, i) => { if (skip[i]) return; const id = item[i] || r.item_id; if (id && qty[i] > 0) rows.push({ item_id: id, qty: qty[i], remarks }); });
  if (!rows.length) return toast(L('আমদানির জন্য সঠিক সারি নেই', 'No valid rows to import'), 'err');
  requireWrite(async () => {
    const res = await doWrite(API.bulkStockIn({ date, rows }), '');
    if (res) { closeModal(); toast(L(nf(res.data.count) + ' টি এন্ট্রি যোগ হয়েছে', 'Imported ' + res.data.count + ' receipts'), 'ok'); switchView('stockin'); renderStockIn(); }
  });
}
