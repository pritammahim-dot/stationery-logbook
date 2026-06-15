/*
 * api.js — the only place that talks to the backend.
 *
 * Two modes, identical interface so app.js never branches:
 *   • LIVE  — when config.js has an API_URL: talks to the Apps Script Web App.
 *   • DEMO  — when API_URL is empty: an in-memory simulation seeded from
 *             demo-data.js, so every screen works with no backend. (Demo PIN: 1234)
 *
 * CORS-CRITICAL (live mode): GET is a simple request; writes POST as
 * text/plain with NO custom headers, so the browser skips the preflight that
 * Apps Script cannot answer. The secret travels in the JSON body.
 */
'use strict';

const API = (function () {
  const CFG = window.APP_CONFIG || {};
  const URL = String(CFG.API_URL || '').trim();
  const DEMO = !URL;
  const DEMO_PIN = '1234';

  let SECRET = '';                              // PIN held in memory for the session only
  const setSecret = (s) => { SECRET = s || ''; };
  const hasSecret = () => !!SECRET;

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.floor(Math.random() * 1e9);
  }

  /* ---------------- LIVE backend ---------------- */
  async function parseJson(res) {
    const text = await res.text();
    try { return JSON.parse(text); }
    catch (_) {
      return { ok: false, code: 'error', data: { msg: 'Server returned non-JSON — check the deployment URL and that access is set to "Anyone".', raw: text.slice(0, 160) } };
    }
  }
  async function liveGetAll() {
    try {
      const res = await fetch(URL + '?action=getAll&v=' + Date.now(), { method: 'GET' });
      return await parseJson(res);
    } catch (e) { return { ok: false, code: 'network', data: { msg: String(e) } }; }
  }
  async function livePost(action, payload) {
    try {
      const res = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // simple request → no preflight
        body: JSON.stringify({ action, secret: SECRET, idemKey: uuid(), payload })
      });
      return await parseJson(res);
    } catch (e) { return { ok: false, code: 'network', data: { msg: String(e) } }; }
  }

  /* ---------------- DEMO backend (in-memory) ---------------- */
  let STORE = null;
  function store() {
    if (!STORE) STORE = JSON.parse(JSON.stringify(window.DEMO_DATA || { sections: [], items: [], users: [], stockIn: [], stockOut: [], cycles: [], requirements: [], meta: {} }));
    return STORE;
  }
  const pad = (n, w) => { let s = String(n); while (s.length < w) s = '0' + s; return s; };
  const nowIso = () => new Date().toISOString().slice(0, 19);
  function seq(key) { const s = store(); s.meta[key] = Number(s.meta[key] || 0) + 1; return s.meta[key]; }
  function demoBalance(itemId) {
    const b = Compute.computeBalances(store().items, store().stockIn, store().stockOut);
    return b[itemId] ? b[itemId].balance : 0;
  }
  function ok(data) { return { ok: true, code: 'ok', data }; }
  function err(code, data) { return { ok: false, code, data: data || {} }; }

  async function demoCall(action, p) {
    if (SECRET !== DEMO_PIN) return err('bad_secret');
    if (action === 'auth') return ok({ auth: true });
    const s = store();
    const need = (fields) => { for (const f of fields) if (p == null || p[f] == null || p[f] === '') return f; return null; };

    if (action === 'addItem') {
      const m = need(['name_bn', 'unit']); if (m) return err('validation', { field: m });
      const item = { item_id: 'ITM-' + pad(seq('item_seq'), 4), name_bn: p.name_bn, name_en: p.name_en || p.name_bn, unit: p.unit, category: p.category || '', reorder_level: p.reorder_level === '' || p.reorder_level == null ? '' : Number(p.reorder_level), opening_balance: Number(p.opening_balance || 0), spec: p.spec || '', active: p.active === false ? 'FALSE' : 'TRUE', created_at: nowIso(), created_by: 'demo', updated_at: '' };
      s.items.push(item); return ok({ item });
    }
    if (action === 'updateItem') {
      const it = s.items.find((x) => x.item_id === p.item_id); if (!it) return err('not_found', { id: p.item_id });
      ['name_bn', 'name_en', 'unit', 'category', 'reorder_level', 'opening_balance', 'spec', 'active'].forEach((f) => {
        if (p[f] !== undefined) it[f] = (f === 'reorder_level') ? (p[f] === '' ? '' : Number(p[f])) : (f === 'opening_balance') ? Number(p[f] || 0) : p[f];
      });
      it.updated_at = nowIso(); return ok({ item: it });
    }
    if (action === 'addUser') {
      const m = need(['name_bn', 'section_id']); if (m) return err('validation', { field: m });
      const user = { user_id: 'USR-' + pad(seq('user_seq'), 2), name_bn: p.name_bn, designation: p.designation || '', section_id: p.section_id, active: p.active === false ? 'FALSE' : 'TRUE', created_at: nowIso(), created_by: 'demo', updated_at: '' };
      s.users.push(user); return ok({ user });
    }
    if (action === 'updateUser') {
      const u = s.users.find((x) => x.user_id === p.user_id); if (!u) return err('not_found', { id: p.user_id });
      ['name_bn', 'designation', 'section_id', 'active'].forEach((f) => { if (p[f] !== undefined) u[f] = p[f]; });
      u.updated_at = nowIso(); return ok({ user: u });
    }
    if (action === 'addSection') {
      const m = need(['name_bn']); if (m) return err('validation', { field: m });
      const n = seq('section_seq'); const section = { section_id: 'SEC-' + pad(n, 2), name_bn: p.name_bn, name_en: p.name_en || '', sort_order: n, active: 'TRUE' };
      s.sections.push(section); return ok({ section });
    }
    if (action === 'updateSection') {
      const sec = s.sections.find((x) => x.section_id === p.section_id); if (!sec) return err('not_found', { id: p.section_id });
      ['name_bn', 'name_en', 'sort_order', 'active'].forEach((f) => { if (p[f] !== undefined) sec[f] = (f === 'active') ? (p[f] ? 'TRUE' : 'FALSE') : p[f]; });
      return ok({ section: sec });
    }
    if (action === 'setMeta') {
      const m = need(['key']); if (m) return err('validation', { field: m });
      s.meta[p.key] = p.value; return ok({ key: p.key, value: p.value });
    }
    if (action === 'addCycle') {
      const m = need(['name']); if (m) return err('validation', { field: m });
      const n = seq('cycle_seq'); const cycle = { cycle_id: 'CYC-' + pad(n, 2), name: p.name, start_date: p.start_date || '', end_date: p.end_date || '', status: p.status === 'closed' ? 'closed' : 'open', created_at: nowIso(), created_by: 'demo' };
      (s.cycles = s.cycles || []).push(cycle); return ok({ cycle });
    }
    if (action === 'updateCycle') {
      const c = (s.cycles || []).find((x) => x.cycle_id === p.cycle_id); if (!c) return err('not_found', { id: p.cycle_id });
      ['name', 'start_date', 'end_date', 'status'].forEach((f) => { if (p[f] !== undefined) c[f] = p[f]; }); return ok({ cycle: c });
    }
    if (action === 'setRequirement') {
      const m = need(['cycle_id', 'scope', 'scope_id', 'item_id']); if (m) return err('validation', { field: m });
      s.requirements = s.requirements || []; const qv = Number(p.qty || 0);
      let r = s.requirements.find((x) => x.cycle_id === p.cycle_id && x.scope === p.scope && x.scope_id === p.scope_id && x.item_id === p.item_id);
      if (r) { r.qty = qv; r.note = p.note || ''; r.updated_at = nowIso(); }
      else { r = { req_id: 'REQ-' + pad(seq('req_seq'), 4), cycle_id: p.cycle_id, scope: p.scope, scope_id: p.scope_id, item_id: p.item_id, qty: qv, note: p.note || '', created_at: nowIso(), created_by: 'demo', updated_at: '' }; s.requirements.push(r); }
      return ok({ requirement: r });
    }
    if (action === 'stockIn') {
      const m = need(['date', 'item_id', 'qty']); if (m) return err('validation', { field: m });
      if (!(Number(p.qty) > 0)) return err('validation', { field: 'qty' });
      const txn = { txn_id: 'IN-' + p.date.replace(/-/g, '') + '-' + uuid().slice(0, 4), date: p.date, item_id: p.item_id, qty: Number(p.qty), remarks: p.remarks || '', month: p.date.slice(0, 7), status: 'active', created_at: nowIso(), created_by: 'demo' };
      s.stockIn.push(txn); return ok({ txn, entity: 'stockIn' });
    }
    if (action === 'bulkStockIn') {
      if (!Array.isArray(p.rows) || !p.rows.length) return err('validation', { field: 'rows' });
      const created = [];
      p.rows.forEach((row) => {
        const qty = Number(row.qty); if (!(qty > 0) || !row.item_id) return;
        const date = row.date || p.date;
        const txn = { txn_id: 'IN-' + String(date).replace(/-/g, '') + '-' + uuid().slice(0, 4), date, item_id: row.item_id, qty, remarks: row.remarks || '', month: String(date).slice(0, 7), status: 'active', created_at: nowIso(), created_by: 'demo' };
        s.stockIn.push(txn); created.push(txn);
      });
      if (!created.length) return err('validation', { msg: 'no valid rows' });
      return ok({ created, count: created.length, entity: 'stockIn' });
    }
    if (action === 'stockOut') {
      const m = need(['date', 'user_id', 'item_id', 'qty']); if (m) return err('validation', { field: m });
      if (!(Number(p.qty) > 0)) return err('validation', { field: 'qty' });
      const bal = demoBalance(p.item_id);
      if (Number(p.qty) > bal && !p.allowNegative) return err('insufficient_stock', { itemId: p.item_id, balance: bal, requested: Number(p.qty) });
      const u = s.users.find((x) => x.user_id === p.user_id);
      const txn = { txn_id: 'OUT-' + p.date.replace(/-/g, '') + '-' + uuid().slice(0, 4), date: p.date, user_id: p.user_id, item_id: p.item_id, qty: Number(p.qty), section_id: u ? u.section_id : '', cycle_id: p.cycle_id || '', month: p.date.slice(0, 7), slip_no: 'SLP-' + pad(seq('slip_seq'), 6), status: 'active', created_at: nowIso(), created_by: 'demo' };
      s.stockOut.push(txn); return ok({ txn, entity: 'stockOut', balanceAfter: bal - Number(p.qty) });
    }
    if (action === 'voidEntry') {
      const arr = p.entity === 'stockIn' ? s.stockIn : s.stockOut;
      const t = arr.find((x) => x.txn_id === p.txn_id); if (!t) return err('not_found', { id: p.txn_id });
      t.status = 'void'; t.void_reason = p.reason || ''; t.voided_at = nowIso(); return ok({ txn: t, entity: p.entity });
    }
    return err('error', { msg: 'unknown action ' + action });
  }

  /* ---------------- unified interface ---------------- */
  const call = (action, payload) => DEMO ? demoCall(action, payload) : livePost(action, payload);

  return {
    DEMO, DEMO_PIN, setSecret, hasSecret,
    auth: () => call('auth', {}),
    getAll: () => DEMO ? Promise.resolve(ok(JSON.parse(JSON.stringify(store())))) : liveGetAll(),
    addItem: (p) => call('addItem', p),
    updateItem: (p) => call('updateItem', p),
    addUser: (p) => call('addUser', p),
    updateUser: (p) => call('updateUser', p),
    stockIn: (p) => call('stockIn', p),
    bulkStockIn: (p) => call('bulkStockIn', p),
    stockOut: (p) => call('stockOut', p),
    voidEntry: (p) => call('voidEntry', p),
    addSection: (p) => call('addSection', p),
    updateSection: (p) => call('updateSection', p),
    setMeta: (p) => call('setMeta', p),
    addCycle: (p) => call('addCycle', p),
    updateCycle: (p) => call('updateCycle', p),
    setRequirement: (p) => call('setRequirement', p)
  };
})();
