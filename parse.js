/*
 * parse.js — PURE helpers for importing a stock-in file (no DOM, no network).
 * Turns a 2D grid (from a spreadsheet or PDF text) into review rows matched to
 * the item master. Shared by the browser (window.Parse) and Node tests.
 * The browser-only bits (loading SheetJS/PDF.js, reading the File) live in app.js.
 */
;(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Parse = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BN = '০১২৩৪৫৬৭৮৯';
  function deBn(s) { return String(s == null ? '' : s).replace(/[০-৯]/g, function (d) { return BN.indexOf(d); }); }
  // lowercase, ASCII-ise Bengali digits, keep latin + bengali letters, collapse the rest to spaces
  function normalize(s) { return deBn(s).toLowerCase().replace(/[^a-z0-9ঀ-৿]+/g, ' ').trim(); }
  // tolerant number parse (handles "১,২০০", "12 pcs", "3.5")
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var m = deBn(v).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : 0;
  }

  // header keywords (normalized). ID is matched exactly only (too short for fuzzy).
  var ID_HEADERS = ['item_id', 'itemid', 'item id', 'code', 'itemcode', 'item code'];
  var ITEM_HEADERS = ['item', 'item name', 'itemname', 'name', 'description', 'desc', 'particulars', 'product', 'goods', 'আইটেম', 'নাম', 'পণ্য', 'বিবরণ', 'মালামাল', 'মালামালের নাম', 'দ্রব্য'];
  var QTY_HEADERS = ['qty', 'quantity', 'quantityreceived', 'quantity received', 'received', 'qnty', 'nos', 'units', 'পরিমাণ', 'সংখ্যা', 'পরিমান'];
  var DATE_HEADERS = ['date', 'তারিখ'];
  var REMARK_HEADERS = ['remark', 'remarks', 'note', 'notes', 'comment', 'মন্তব্য'];

  function findCol(H, cands, exactOnly) {
    var i;
    for (i = 0; i < H.length; i++) if (H[i] && cands.indexOf(H[i]) >= 0) return i;
    if (exactOnly) return -1;
    for (i = 0; i < H.length; i++) if (H[i] && cands.some(function (c) { return H[i].indexOf(c) >= 0 || c.indexOf(H[i]) >= 0; })) return i;
    return -1;
  }
  function detectColumns(headerRow) {
    var H = (headerRow || []).map(normalize);
    return { idCol: findCol(H, ID_HEADERS, true), itemCol: findCol(H, ITEM_HEADERS), qtyCol: findCol(H, QTY_HEADERS), dateCol: findCol(H, DATE_HEADERS), remarksCol: findCol(H, REMARK_HEADERS) };
  }

  function lev(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      var t = prev; prev = cur; cur = t;
    }
    return prev[n];
  }
  function similarity(a, b) { a = normalize(a); b = normalize(b); if (!a || !b) return 0; var d = lev(a, b); return 1 - d / (Math.max(a.length, b.length) || 1); }

  // best item-master match for a free-text name; returns {item, score}
  function matchItemName(name, items) {
    var n = normalize(name); if (!n) return { item: null, score: 0 };
    var best = null, bestScore = 0;
    (items || []).forEach(function (it) {
      [it.name_en, it.name_bn, it.item_id].forEach(function (cand) {
        if (!cand) return;
        var c = normalize(cand), s;
        if (c === n) s = 1;
        else if (c && (c.indexOf(n) >= 0 || n.indexOf(c) >= 0)) s = 0.9;
        else s = similarity(n, c);
        if (s > bestScore) { bestScore = s; best = it; }
      });
    });
    return { item: best, score: bestScore };
  }

  // 2D grid -> { header, cols, rows:[{rawName,rawId,qty,item_id,score,status,date,remarks}] }
  // status: matched (>=0.9 or id hit) | fuzzy (>=0.55) | unmatched
  function resolveRows(grid, items) {
    var rows = (grid || []).filter(function (r) { return r && r.some(function (c) { return String(c == null ? '' : c).trim() !== ''; }); });
    if (!rows.length) return { header: -1, cols: {}, rows: [] };
    var headerIdx = -1, cols = null;
    for (var i = 0; i < Math.min(rows.length, 6); i++) {
      var c = detectColumns(rows[i]);
      if (c.qtyCol >= 0 && (c.itemCol >= 0 || c.idCol >= 0)) { headerIdx = i; cols = c; break; }
    }
    var start, col;
    if (headerIdx >= 0) { start = headerIdx + 1; col = cols; }
    else { start = 0; col = { idCol: -1, itemCol: 0, qtyCol: 1, dateCol: -1, remarksCol: -1 }; }   // fallback: name, qty
    var byId = {}; (items || []).forEach(function (it) { byId[String(it.item_id).toLowerCase()] = it; });
    var out = [];
    for (var r = start; r < rows.length; r++) {
      var row = rows[r];
      var rawName = col.itemCol >= 0 ? String(row[col.itemCol] == null ? '' : row[col.itemCol]).trim() : '';
      var rawId = col.idCol >= 0 ? String(row[col.idCol] == null ? '' : row[col.idCol]).trim() : '';
      var qty = num(col.qtyCol >= 0 ? row[col.qtyCol] : '');
      if (!rawName && !rawId) continue;
      var item = null, score = 0, status = 'unmatched';
      if (rawId && byId[rawId.toLowerCase()]) { item = byId[rawId.toLowerCase()]; score = 1; status = 'matched'; }
      else if (rawName) { var m = matchItemName(rawName, items); score = m.score; status = score >= 0.9 ? 'matched' : score >= 0.5 ? 'fuzzy' : 'unmatched'; item = status === 'unmatched' ? null : m.item; }
      out.push({ rawName: rawName, rawId: rawId, qty: qty, item_id: item ? item.item_id : '', score: score, status: status,
        date: col.dateCol >= 0 ? String(row[col.dateCol] == null ? '' : row[col.dateCol]).trim() : '',
        remarks: col.remarksCol >= 0 ? String(row[col.remarksCol] == null ? '' : row[col.remarksCol]).trim() : '' });
    }
    return { header: headerIdx, cols: col, rows: out };
  }

  // PDF text -> 2D grid (best-effort): keep lines that end in a quantity number
  function parsePdfText(text) {
    var lines = String(text || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var grid = [['Item', 'Quantity']];
    lines.forEach(function (l) {
      var m = deBn(l).match(/^(.*?[a-zঀ-৿)\]].*?)[\s.:\-]+(\d{1,6}(?:[.,]\d+)?)\s*(?:pcs?|pieces?|reams?|boxes?|box|nos?\.?|units?)?\.?$/i);
      if (m && normalize(m[1]).length >= 2) grid.push([m[1].trim(), m[2]]);
    });
    return grid;
  }

  return { normalize: normalize, num: num, detectColumns: detectColumns, similarity: similarity, matchItemName: matchItemName, resolveRows: resolveRows, parsePdfText: parsePdfText };
});
