/*
 * Code.gs — Stationery Logbook backend (Google Apps Script Web App).
 *
 * This script is BOUND to the Google Sheet (Extensions → Apps Script).
 * It is the JSON API the static website talks to.
 *
 * ONE-TIME SETUP (run from the editor, in this order):
 *   1) Run  setupSheets()   — creates the 7 tabs with headers + Meta defaults.
 *   2) Run  seedMasters()   — fills Sections/Items/Users with the office data.
 *   3) Project Settings → Script Properties → add  WRITE_SECRET = <your PIN>.
 *   4) Deploy → New deployment → Web app → Execute as: Me, Access: Anyone.
 *   5) Copy the /exec URL into the website's config.js (API_URL).
 * After editing this file later: Deploy → Manage deployments → Edit → New version
 * (keeps the same /exec URL).
 *
 * SECURITY: reads (getAll) are open; every write requires the secret in the
 * request body (never a header — that would trigger a CORS preflight Apps
 * Script can't answer). The secret lives only here in Script Properties.
 */

'use strict';

var TABS = {
  sections: 'Sections',
  items:    'Items',
  users:    'Users',
  stockIn:  'StockIn',
  stockOut: 'StockOut',
  meta:     'Meta',
  audit:    'AuditLog'
};

var HEADERS = {
  Sections:  ['section_id', 'name_bn', 'name_en', 'sort_order', 'active'],
  Items:     ['item_id', 'name_bn', 'name_en', 'unit', 'category', 'reorder_level', 'opening_balance', 'spec', 'active', 'created_at', 'created_by', 'updated_at'],
  Users:     ['user_id', 'name_bn', 'designation', 'section_id', 'active', 'created_at', 'created_by', 'updated_at'],
  StockIn:   ['txn_id', 'date', 'item_id', 'qty', 'remarks', 'month', 'status', 'created_at', 'created_by', 'void_reason', 'voided_at', 'voided_by'],
  StockOut:  ['txn_id', 'date', 'user_id', 'item_id', 'qty', 'section_id', 'month', 'slip_no', 'status', 'created_at', 'created_by', 'void_reason', 'voided_at', 'voided_by'],
  Meta:      ['key', 'value'],
  AuditLog:  ['ts', 'actor', 'action', 'entity', 'entity_id', 'detail_json']
};

/* =========================================================================
 *  HTTP entry points
 * ========================================================================= */

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || 'ping';
    if (action === 'getAll')   return jsonOut({ ok: true, code: 'ok', data: readAll() });
    if (action === 'ping')     return jsonOut({ ok: true, code: 'ok', data: { service: 'stationery-logbook', time: nowIso() } });
    return jsonOut({ ok: false, code: 'error', data: { msg: 'unknown action: ' + action } });
  } catch (err) {
    return jsonOut({ ok: false, code: 'error', data: { msg: String(err) } });
  }
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); }
  catch (_) { return jsonOut({ ok: false, code: 'error', data: { msg: 'invalid JSON body' } }); }

  // every write must carry the shared secret in the body
  if (!checkSecret(req.secret)) return jsonOut({ ok: false, code: 'bad_secret' });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return jsonOut({ ok: false, code: 'error', data: { msg: 'server busy, try again' } });
  try {
    // idempotency: replay a previously-processed request instead of duplicating it
    if (req.idemKey) {
      var cached = CacheService.getScriptCache().get('idem:' + req.idemKey);
      if (cached) return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
    }

    var out;
    switch (req.action) {
      case 'auth':       out = { ok: true, code: 'ok', data: { auth: true } }; break;
      case 'addItem':    out = addItem(req.payload, req); break;
      case 'updateItem': out = updateItem(req.payload, req); break;
      case 'addUser':    out = addUser(req.payload, req); break;
      case 'updateUser': out = updateUser(req.payload, req); break;
      case 'addSection':    out = addSection(req.payload, req); break;
      case 'updateSection': out = updateSection(req.payload, req); break;
      case 'stockIn':    out = stockIn(req.payload, req); break;
      case 'stockOut':   out = stockOut(req.payload, req); break;
      case 'voidEntry':  out = voidEntry(req.payload, req); break;
      case 'setMeta':    out = setMetaAction(req.payload, req); break;
      default:           out = { ok: false, code: 'error', data: { msg: 'unknown action: ' + req.action } };
    }

    if (out.ok && req.action !== 'auth') {
      audit(req.action, out.data, req);
      if (req.idemKey) CacheService.getScriptCache().put('idem:' + req.idemKey, JSON.stringify(out), 21600);
    }
    return jsonOut(out);
  } catch (err) {
    return jsonOut({ ok: false, code: 'error', data: { msg: String(err) } });
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================================
 *  Actions
 * ========================================================================= */

function addItem(p, req) {
  var miss = required(p, ['name_bn', 'unit']); if (miss) return miss;
  var id = 'ITM-' + pad(nextSeq('item_seq'), 4);
  var obj = {
    item_id: id,
    name_bn: str(p.name_bn),
    name_en: str(p.name_en || p.name_bn),
    unit: str(p.unit),
    category: str(p.category),
    reorder_level: p.reorder_level === '' || p.reorder_level == null ? '' : Number(p.reorder_level),
    opening_balance: Number(p.opening_balance || 0),
    spec: str(p.spec),
    active: p.active === false ? 'FALSE' : 'TRUE',
    created_at: nowIso(),
    created_by: actor(req),
    updated_at: ''
  };
  appendObj(TABS.items, obj);
  return { ok: true, code: 'ok', data: { item: obj } };
}

function updateItem(p, req) {
  var miss = required(p, ['item_id']); if (miss) return miss;
  var found = findRow(TABS.items, 'item_id', p.item_id);
  if (!found) return { ok: false, code: 'not_found', data: { id: p.item_id } };
  var fields = ['name_bn', 'name_en', 'unit', 'category', 'reorder_level', 'opening_balance', 'spec', 'active'];
  fields.forEach(function (f) {
    if (p[f] !== undefined) {
      if (f === 'active') found.obj[f] = (p[f] === false || p[f] === 'FALSE') ? 'FALSE' : 'TRUE';
      else if (f === 'reorder_level') found.obj[f] = (p[f] === '' || p[f] == null) ? '' : Number(p[f]);
      else if (f === 'opening_balance') found.obj[f] = Number(p[f] || 0);
      else found.obj[f] = str(p[f]);
    }
  });
  found.obj.updated_at = nowIso();
  writeRow(TABS.items, found);
  return { ok: true, code: 'ok', data: { item: found.obj } };
}

function addUser(p, req) {
  var miss = required(p, ['name_bn', 'section_id']); if (miss) return miss;
  var id = 'USR-' + pad(nextSeq('user_seq'), 2);
  var obj = {
    user_id: id,
    name_bn: str(p.name_bn),
    designation: str(p.designation),
    section_id: str(p.section_id),
    active: p.active === false ? 'FALSE' : 'TRUE',
    created_at: nowIso(),
    created_by: actor(req),
    updated_at: ''
  };
  appendObj(TABS.users, obj);
  return { ok: true, code: 'ok', data: { user: obj } };
}

function updateUser(p, req) {
  var miss = required(p, ['user_id']); if (miss) return miss;
  var found = findRow(TABS.users, 'user_id', p.user_id);
  if (!found) return { ok: false, code: 'not_found', data: { id: p.user_id } };
  ['name_bn', 'designation', 'section_id', 'active'].forEach(function (f) {
    if (p[f] !== undefined) {
      if (f === 'active') found.obj[f] = (p[f] === false || p[f] === 'FALSE') ? 'FALSE' : 'TRUE';
      else found.obj[f] = str(p[f]);
    }
  });
  found.obj.updated_at = nowIso();
  writeRow(TABS.users, found);
  return { ok: true, code: 'ok', data: { user: found.obj } };
}

function addSection(p, req) {
  var miss = required(p, ['name_bn']); if (miss) return miss;
  var n = nextSeq('section_seq');
  var obj = { section_id: 'SEC-' + pad(n, 2), name_bn: str(p.name_bn), name_en: str(p.name_en), sort_order: n, active: 'TRUE' };
  appendObj(TABS.sections, obj);
  return { ok: true, code: 'ok', data: { section: obj } };
}

function updateSection(p, req) {
  var miss = required(p, ['section_id']); if (miss) return miss;
  var found = findRow(TABS.sections, 'section_id', p.section_id);
  if (!found) return { ok: false, code: 'not_found', data: { id: p.section_id } };
  ['name_bn', 'name_en', 'sort_order', 'active'].forEach(function (f) {
    if (p[f] !== undefined) {
      if (f === 'active') found.obj[f] = (p[f] === false || p[f] === 'FALSE') ? 'FALSE' : 'TRUE';
      else found.obj[f] = str(p[f]);
    }
  });
  writeRow(TABS.sections, found);
  return { ok: true, code: 'ok', data: { section: found.obj } };
}

function stockIn(p, req) {
  var miss = required(p, ['date', 'item_id', 'qty']); if (miss) return miss;
  var qty = Number(p.qty);
  if (!(qty > 0)) return { ok: false, code: 'validation', data: { field: 'qty', msg: 'quantity must be greater than 0' } };
  if (!findRow(TABS.items, 'item_id', p.item_id)) return { ok: false, code: 'not_found', data: { id: p.item_id } };
  var date = str(p.date);
  var obj = {
    txn_id: 'IN-' + ymd(date) + '-' + hex4(),
    date: date,
    item_id: str(p.item_id),
    qty: qty,
    remarks: str(p.remarks),
    month: date.slice(0, 7),
    status: 'active',
    created_at: nowIso(),
    created_by: actor(req),
    void_reason: '', voided_at: '', voided_by: ''
  };
  appendObj(TABS.stockIn, obj);
  return { ok: true, code: 'ok', data: { txn: obj, entity: 'stockIn' } };
}

function stockOut(p, req) {
  var miss = required(p, ['date', 'user_id', 'item_id', 'qty']); if (miss) return miss;
  var qty = Number(p.qty);
  if (!(qty > 0)) return { ok: false, code: 'validation', data: { field: 'qty', msg: 'quantity must be greater than 0' } };
  var user = findRow(TABS.users, 'user_id', p.user_id);
  if (!user) return { ok: false, code: 'not_found', data: { id: p.user_id } };
  if (!findRow(TABS.items, 'item_id', p.item_id)) return { ok: false, code: 'not_found', data: { id: p.item_id } };

  // authoritative balance check INSIDE the lock — prevents oversell/negative stock
  var bal = serverBalance(p.item_id);
  if (qty > bal && !p.allowNegative) {
    return { ok: false, code: 'insufficient_stock', data: { itemId: p.item_id, balance: bal, requested: qty } };
  }
  var date = str(p.date);
  var obj = {
    txn_id: 'OUT-' + ymd(date) + '-' + hex4(),
    date: date,
    user_id: str(p.user_id),
    item_id: str(p.item_id),
    qty: qty,
    section_id: str(user.obj.section_id),   // snapshot the user's section at issue time
    month: date.slice(0, 7),
    slip_no: 'SLP-' + pad(nextSeq('slip_seq'), 6),
    status: 'active',
    created_at: nowIso(),
    created_by: actor(req),
    void_reason: '', voided_at: '', voided_by: ''
  };
  appendObj(TABS.stockOut, obj);
  return { ok: true, code: 'ok', data: { txn: obj, entity: 'stockOut', balanceAfter: bal - qty } };
}

function voidEntry(p, req) {
  var miss = required(p, ['entity', 'txn_id']); if (miss) return miss;
  var tab = p.entity === 'stockIn' ? TABS.stockIn : p.entity === 'stockOut' ? TABS.stockOut : null;
  if (!tab) return { ok: false, code: 'validation', data: { field: 'entity', msg: 'entity must be stockIn or stockOut' } };
  var found = findRow(tab, 'txn_id', p.txn_id);
  if (!found) return { ok: false, code: 'not_found', data: { id: p.txn_id } };
  if (String(found.obj.status).toLowerCase() === 'void') return { ok: false, code: 'validation', data: { msg: 'already voided' } };
  found.obj.status = 'void';
  found.obj.void_reason = str(p.reason);
  found.obj.voided_at = nowIso();
  found.obj.voided_by = actor(req);
  writeRow(tab, found);
  return { ok: true, code: 'ok', data: { txn: found.obj, entity: p.entity } };
}

function setMetaAction(p, req) {
  var miss = required(p, ['key']); if (miss) return miss;
  setMeta(str(p.key), p.value);
  return { ok: true, code: 'ok', data: { key: p.key, value: p.value } };
}

/* =========================================================================
 *  Read
 * ========================================================================= */

function readAll() {
  return {
    sections: readObjects(TABS.sections),
    items:    readObjects(TABS.items),
    users:    readObjects(TABS.users),
    stockIn:  readObjects(TABS.stockIn),
    stockOut: readObjects(TABS.stockOut),
    meta:     readMeta()
  };
}

/* =========================================================================
 *  Sheet helpers (header-keyed, so column order can change safely)
 * ========================================================================= */

function ss() { return SpreadsheetApp.getActive(); }
function getSheet(name) { return ss().getSheetByName(name); }
function tz() { return ss().getSpreadsheetTimeZone() || 'Asia/Dhaka'; }

function cellToStr(v) {
  if (v instanceof Date) {
    var iso = Utilities.formatDate(v, tz(), "yyyy-MM-dd'T'HH:mm:ss");
    return iso.indexOf('T00:00:00') === iso.length - 9 ? iso.slice(0, 10) : iso;
  }
  return v;
}

function readObjects(name) {
  var sh = getSheet(name);
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row.join('') === '') continue;            // skip blank rows
    var o = {};
    for (var c = 0; c < headers.length; c++) {
      if (headers[c] !== '') o[headers[c]] = cellToStr(row[c]);
    }
    out.push(o);
  }
  return out;
}

function appendObj(name, obj) {
  var sh = getSheet(name);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var row = headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
  sh.appendRow(row);
}

function findRow(name, idField, idValue) {
  var sh = getSheet(name);
  if (!sh) return null;
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf(idField);
  if (idCol < 0) return null;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(idValue)) {
      var o = {};
      for (var c = 0; c < headers.length; c++) if (headers[c] !== '') o[headers[c]] = cellToStr(values[i][c]);
      return { sheet: sh, rowIndex: i + 1, headers: headers, obj: o };
    }
  }
  return null;
}

function writeRow(name, found) {
  var row = found.headers.map(function (h) { return found.obj[h] !== undefined ? found.obj[h] : ''; });
  found.sheet.getRange(found.rowIndex, 1, 1, row.length).setValues([row]);
}

/* ---- Meta (key/value) ---- */

function readMeta() {
  var rows = readObjects(TABS.meta);
  var o = {};
  rows.forEach(function (r) { o[r.key] = r.value; });
  return o;
}
function getMeta(key) {
  var f = findRow(TABS.meta, 'key', key);
  return f ? f.obj.value : null;
}
function setMeta(key, value) {
  var f = findRow(TABS.meta, 'key', key);
  if (f) { f.obj.value = value; writeRow(TABS.meta, f); }
  else { appendObj(TABS.meta, { key: key, value: value }); }
}
function nextSeq(key) {
  var v = Number(getMeta(key) || 0) + 1;
  setMeta(key, v);
  return v;
}

/* ---- balance authority (server-side) ---- */

function serverBalance(itemId) {
  var item = findRow(TABS.items, 'item_id', itemId);
  var bal = item ? Number(item.obj.opening_balance || 0) : 0;
  readObjects(TABS.stockIn).forEach(function (r) {
    if (r.item_id === itemId && String(r.status).toLowerCase() !== 'void') bal += Number(r.qty || 0);
  });
  readObjects(TABS.stockOut).forEach(function (r) {
    if (r.item_id === itemId && String(r.status).toLowerCase() !== 'void') bal -= Number(r.qty || 0);
  });
  return bal;
}

/* ---- misc helpers ---- */

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function checkSecret(secret) {
  var want = PropertiesService.getScriptProperties().getProperty('WRITE_SECRET');
  return !!want && String(secret) === String(want);
}
function required(p, fields) {
  for (var i = 0; i < fields.length; i++) {
    if (p == null || p[fields[i]] == null || p[fields[i]] === '') {
      return { ok: false, code: 'validation', data: { field: fields[i], msg: fields[i] + ' is required' } };
    }
  }
  return null;
}
function actor(req) { return (req && req.payload && req.payload.by) ? str(req.payload.by) : 'office'; }
function str(v) { return v == null ? '' : String(v); }
function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
function hex4() { return Utilities.getUuid().replace(/-/g, '').slice(0, 4); }
function ymd(dateStr) { return String(dateStr).slice(0, 10).replace(/-/g, ''); }
function nowIso() { return Utilities.formatDate(new Date(), tz(), "yyyy-MM-dd'T'HH:mm:ss"); }

function audit(action, data, req) {
  try {
    var entity = data && data.entity ? data.entity : (data && data.item ? 'item' : data && data.user ? 'user' : data && data.section ? 'section' : '');
    var id = '';
    if (data) {
      if (data.txn) id = data.txn.txn_id;
      else if (data.item) id = data.item.item_id;
      else if (data.user) id = data.user.user_id;
      else if (data.section) id = data.section.section_id;
      else if (data.key) id = data.key;
    }
    appendObj(TABS.audit, {
      ts: nowIso(), actor: actor(req), action: action,
      entity: entity, entity_id: id, detail_json: JSON.stringify(req.payload || {})
    });
  } catch (e) { /* audit must never break a write */ }
}

/* =========================================================================
 *  One-time editor functions (run manually from the Apps Script editor)
 * ========================================================================= */

// Create any missing tabs with the correct header row, and seed Meta defaults.
function setupSheets() {
  var book = ss();
  Object.keys(HEADERS).forEach(function (name) {
    var sh = book.getSheetByName(name);
    if (!sh) sh = book.insertSheet(name);
    var firstRow = sh.getRange(1, 1, 1, HEADERS[name].length).getValues()[0];
    if (firstRow.join('') === '') sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
    sh.setFrozenRows(1);
  });
  // remove the default empty "Sheet1" if present and unused
  var def = book.getSheetByName('Sheet1');
  if (def && book.getSheets().length > 1 && def.getLastRow() === 0) book.deleteSheet(def);

  var defaults = {
    schema_version: '1', item_seq: '0', user_seq: '0', section_seq: '0', slip_seq: '0',
    low_stock_default: '5', office_name_bn: 'পরিকল্পনা ও উন্নয়ন বিভাগ', office_name_en: 'Planning & Development Division'
  };
  Object.keys(defaults).forEach(function (k) { if (getMeta(k) == null) setMeta(k, defaults[k]); });
  book.setSpreadsheetTimeZone('Asia/Dhaka');
  SpreadsheetApp.getActiveSpreadsheet().toast('setupSheets complete', 'Stationery Logbook', 5);
}

// Fill Sections/Items/Users with the office's starting data. Safe to skip if
// you imported the seed/*.csv files instead. Refuses to run if Items already has rows.
function seedMasters() {
  if (readObjects(TABS.items).length > 0) throw new Error('Items already populated — seedMasters aborted.');
  var now = nowIso();

  SEED.sections.forEach(function (s, i) {
    appendObj(TABS.sections, { section_id: 'SEC-' + pad(i + 1, 2), name_bn: s[0], name_en: s[1], sort_order: i + 1, active: 'TRUE' });
  });
  SEED.items.forEach(function (it, i) {
    appendObj(TABS.items, {
      item_id: 'ITM-' + pad(i + 1, 4), name_bn: it[0], name_en: it[0], unit: it[1], category: it[2],
      reorder_level: '', opening_balance: 0, spec: '', active: 'TRUE', created_at: now, created_by: 'seed', updated_at: ''
    });
  });
  SEED.users.forEach(function (u, i) {
    appendObj(TABS.users, {
      user_id: 'USR-' + pad(i + 1, 2), name_bn: u[0], designation: '', section_id: u[1],
      active: 'TRUE', created_at: now, created_by: 'seed', updated_at: ''
    });
  });

  setMeta('section_seq', SEED.sections.length);
  setMeta('item_seq', SEED.items.length);
  setMeta('user_seq', SEED.users.length);
  SpreadsheetApp.getActiveSpreadsheet().toast('Seeded ' + SEED.items.length + ' items, ' + SEED.users.length + ' users', 'Stationery Logbook', 5);
}

var SEED = {
  sections: [
    ['পরিকল্পনা ও উন্নয়ন', 'Planning & Development'],
    ['পূর্ত কর্ম', 'Civil Works'],
    ['নকশা ও পরিদর্শন', 'Design & Inspection'],
    ['রেস্টহাউজ', 'Rest House']
  ],
  users: [
    ['এ.টি.এম তারিকুল ইসলাম', 'SEC-01'], ['প্রকৌঃ শহীদুল আলম', 'SEC-01'], ['মোঃ আলিউল আজম', 'SEC-01'],
    ['ফারিয়া হক পুষ্প', 'SEC-01'], ['অরিন মাহমুদ', 'SEC-01'], ['ফারজানা রিক্তা', 'SEC-01'],
    ['তাছনুবা জাহান ফারিয়া', 'SEC-01'], ['মো: কামাল উদ্দিন', 'SEC-02'], ['রবিউল ইসলাম', 'SEC-02'],
    ['নুরুন্নাহার নূপুর', 'SEC-02'], ['মাহিম মুতাসিম প্রিতম', 'SEC-02'], ['আহসান হাবিব', 'SEC-02'],
    ['মোঃ সাব্বির আহাম্মেদ', 'SEC-02'], ['কল্যান কুমার দেবনাথ', 'SEC-03'], ['ফয়সাল আহমেদ সৌরভ', 'SEC-03'],
    ['মোঃ কাউসার আলী', 'SEC-03'], ['খাদিজা সুলতানা', 'SEC-03'], ['মোঃ শাহাদাত হোসেন সাব্বির', 'SEC-03'],
    ['রুনা', 'SEC-01'], ['ফাতেমা', 'SEC-01'], ['রেস্টহাউজ', 'SEC-04'], ['শিপ্রা', 'SEC-01'], ['আরিফ', 'SEC-01']
  ],
  items: [
    ['A4 Envelope (Handmade Paper)', 'piece', 'কাগজ ও ফাইল'], ['A4 Folder File', 'piece', 'কাগজ ও ফাইল'],
    ['A4 Paper (80 GSM)', 'ream', 'কাগজ ও ফাইল'], ['A4 Plastic File', 'piece', 'কাগজ ও ফাইল'],
    ['Aerosol 250 ml', 'piece', 'পরিষ্কার ও টয়লেট্রিজ'], ['Air Freshener (300 ml)', 'piece', 'পরিষ্কার ও টয়লেট্রিজ'],
    ['Attendance Book', 'piece', 'কাগজ ও ফাইল'], ['Ballpoint Pen (Black)', 'piece', 'লেখার সামগ্রী'],
    ['Ballpoint Pen (Blue)', 'piece', 'লেখার সামগ্রী'], ['Battery (1.5 Volt)', 'piece', 'যন্ত্রপাতি ও সরঞ্জাম'],
    ['Battery (12 Volt)', 'piece', 'যন্ত্রপাতি ও সরঞ্জাম'], ['Board File', 'piece', 'কাগজ ও ফাইল'],
    ['Correction Pen', 'piece', 'লেখার সামগ্রী'], ['Double Punch Machine', 'piece', 'যন্ত্রপাতি ও সরঞ্জাম'],
    ['Eraser', 'piece', 'লেখার সামগ্রী'], ['Facial Tissue', 'piece', 'পরিষ্কার ও টয়লেট্রিজ'],
    ['Fixol (1 Liter)', 'piece', 'লেখার সামগ্রী'], ['Glue Stick', 'piece', 'লেখার সামগ্রী'],
    ['Hand Towel', 'piece', 'পরিষ্কার ও টয়লেট্রিজ'], ['Hand Wash Refill (170 ml)', 'piece', 'পরিষ্কার ও টয়লেট্রিজ'],
    ['Hard Broom', 'piece', 'পরিষ্কার ও টয়লেট্রিজ'], ['Harpic (1 Liter)', 'piece', 'পরিষ্কার ও টয়লেট্রিজ'],
    ['Harpic (750 ml)', 'piece', 'পরিষ্কার ও টয়লেট্রিজ'], ['Highlighter Pen', 'piece', 'লেখার সামগ্রী'],
    ['Lizol (1 Liter)', 'piece', 'পরিষ্কার ও টয়লেট্রিজ'], ['Lizol (500 ml)', 'piece', 'পরিষ্কার ও টয়লেট্রিজ'],
    ['Marker Pen', 'piece', 'লেখার সামগ্রী'], ['Note Binding Thread', 'piece', 'কাগজ ও ফাইল'],
    ['Note Sheet Pad (Legal Size)', 'piece', 'কাগজ ও ফাইল'], ['Odonil', 'piece', 'পরিষ্কার ও টয়লেট্রিজ'],
    ['Paper Clip', 'piece', 'যন্ত্রপাতি ও সরঞ্জাম'], ['Pencil', 'piece', 'লেখার সামগ্রী'],
    ['Pencil Sharpener', 'piece', 'লেখার সামগ্রী'], ['Phenyl (3 Liter)', 'piece', 'পরিষ্কার ও টয়লেট্রিজ'],
    ['Pin Remover', 'piece', 'যন্ত্রপাতি ও সরঞ্জাম'], ['Register Book (200 pages)', 'piece', 'কাগজ ও ফাইল'],
    ['Rexine Tape', 'piece', 'যন্ত্রপাতি ও সরঞ্জাম'], ['Ring File', 'piece', 'কাগজ ও ফাইল'],
    ['Savlon (1 Liter)', 'piece', 'পরিষ্কার ও টয়লেট্রিজ'], ['Scissors', 'piece', 'যন্ত্রপাতি ও সরঞ্জাম'],
    ['Single Punch Machine', 'piece', 'যন্ত্রপাতি ও সরঞ্জাম'], ['Small Letter Envelope (Handmade Paper)', 'piece', 'কাগজ ও ফাইল'],
    ['Soap', 'piece', 'পরিষ্কার ও টয়লেট্রিজ'], ['Soft Broom', 'piece', 'পরিষ্কার ও টয়লেট্রিজ'],
    ['Stamp Ink (Blue)', 'piece', 'লেখার সামগ্রী'], ['Stamp Pad', 'box', 'লেখার সামগ্রী'],
    ['Stapler', 'piece', 'যন্ত্রপাতি ও সরঞ্জাম'], ['Stapler Pins', 'piece', 'যন্ত্রপাতি ও সরঞ্জাম'],
    ['Steel Scale (12 inch)', 'piece', 'লেখার সামগ্রী'], ['Sticky Note', 'piece', 'লেখার সামগ্রী'],
    ['Toilet Tissue (Rolling)', 'piece', 'পরিষ্কার ও টয়লেট্রিজ'], ['Vim Liquid (500 ml)', 'piece', 'পরিষ্কার ও টয়লেট্রিজ'],
    ['White Duster Cloth', 'piece', 'পরিষ্কার ও টয়লেট্রিজ'], ['Cleaner Stick', 'piece', 'পরিষ্কার ও টয়লেট্রিজ']
  ]
};
