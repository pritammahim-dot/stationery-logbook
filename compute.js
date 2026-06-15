/*
 * compute.js — PURE inventory math (no DOM, no network).
 * Shared by the browser app (window.Compute) and Node tests (module.exports).
 *
 * All functions are pure functions of the raw rows fetched from the sheet,
 * so the same code powers the live UI and the unit tests. Voided rows
 * (status === 'void') are excluded from every total. This reproduces the
 * Excel's SUMIFS/pivots, but keyed by stable IDs instead of names.
 */
;(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Compute = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Tolerant number parse (sheet cells may arrive as strings, blanks, etc.)
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (v == null) return 0;
    var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : 0;
  }

  // A transaction counts unless explicitly voided.
  function isLive(row) {
    return !row || String(row.status == null ? 'active' : row.status).toLowerCase() !== 'void';
  }

  // 'YYYY-MM' — prefer the stored month, else slice the ISO date (TZ-safe, no Date()).
  function monthOf(row) {
    if (row.month) return String(row.month).slice(0, 7);
    return row.date ? String(row.date).slice(0, 7) : '';
  }

  function isActiveMaster(row) {
    return String(row.active == null ? 'TRUE' : row.active).toLowerCase() !== 'false';
  }

  function reorderOf(item, lowDefault) {
    var r = num(item.reorder_level);
    return r > 0 ? r : num(lowDefault);
  }

  // item_id -> { in, out, opening, balance }.  balance = opening + Σin − Σout
  function computeBalances(items, stockIn, stockOut) {
    var m = {};
    (items || []).forEach(function (it) {
      m[it.item_id] = { item_id: it.item_id, in: 0, out: 0, opening: num(it.opening_balance), balance: 0 };
    });
    function ensure(id) {
      if (!m[id]) m[id] = { item_id: id, in: 0, out: 0, opening: 0, balance: 0 };
      return m[id];
    }
    (stockIn || []).forEach(function (r) { if (isLive(r)) ensure(r.item_id).in += num(r.qty); });
    (stockOut || []).forEach(function (r) { if (isLive(r)) ensure(r.item_id).out += num(r.qty); });
    Object.keys(m).forEach(function (id) { m[id].balance = m[id].opening + m[id].in - m[id].out; });
    return m;
  }

  function balanceOf(balances, itemId) {
    return balances[itemId] ? balances[itemId].balance : 0;
  }

  // item × month matrix: { months[], items{ id:{total,byMonth{}} }, totalsByMonth{}, grand }
  function monthlyPivot(rows) {
    var monthsSet = {}, items = {}, totalsByMonth = {}, grand = 0;
    (rows || []).forEach(function (r) {
      if (!isLive(r)) return;
      var mo = monthOf(r), id = r.item_id, q = num(r.qty);
      monthsSet[mo] = true;
      if (!items[id]) items[id] = { item_id: id, total: 0, byMonth: {} };
      items[id].byMonth[mo] = (items[id].byMonth[mo] || 0) + q;
      items[id].total += q;
      totalsByMonth[mo] = (totalsByMonth[mo] || 0) + q;
      grand += q;
    });
    return { months: Object.keys(monthsSet).sort(), items: items, totalsByMonth: totalsByMonth, grand: grand };
  }

  // group stock-out rows by a key (user_id / section_id) -> { total, byItem{} }
  function groupOut(stockOut, key) {
    var g = {};
    (stockOut || []).forEach(function (r) {
      if (!isLive(r)) return;
      var k = r[key]; if (k == null || k === '') k = '(unknown)';
      var q = num(r.qty);
      if (!g[k]) g[k] = { key: k, total: 0, byItem: {} };
      g[k].byItem[r.item_id] = (g[k].byItem[r.item_id] || 0) + q;
      g[k].total += q;
    });
    return g;
  }

  function userWiseOut(stockOut) { return groupOut(stockOut, 'user_id'); }
  function sectionWiseOut(stockOut) { return groupOut(stockOut, 'section_id'); }

  // active items at/below their reorder level, worst (most negative slack) first
  function lowStock(items, balances, lowDefault) {
    var out = [];
    (items || []).forEach(function (it) {
      if (!isActiveMaster(it)) return;
      var bal = balanceOf(balances, it.item_id);
      var reorder = reorderOf(it, lowDefault);
      if (bal <= reorder) out.push({ item: it, balance: bal, reorder: reorder, deficit: reorder - bal });
    });
    out.sort(function (a, b) { return (a.balance - a.reorder) - (b.balance - b.reorder); });
    return out;
  }

  // descending totals from a groupOut() result
  function topConsumers(groups, n) {
    var arr = Object.keys(groups).map(function (k) { return { key: k, total: groups[k].total }; });
    arr.sort(function (a, b) { return b.total - a.total; });
    return n ? arr.slice(0, n) : arr;
  }

  // last N months of in/out totals for the trend chart
  function monthlyTrend(stockIn, stockOut, nMonths) {
    var pin = monthlyPivot(stockIn).totalsByMonth;
    var pout = monthlyPivot(stockOut).totalsByMonth;
    var set = {};
    Object.keys(pin).forEach(function (m) { set[m] = true; });
    Object.keys(pout).forEach(function (m) { set[m] = true; });
    var months = Object.keys(set).sort();
    if (nMonths && months.length > nMonths) months = months.slice(months.length - nMonths);
    return months.map(function (m) { return { month: m, in: pin[m] || 0, out: pout[m] || 0 }; });
  }

  // one call that builds every derived structure the UI needs
  function recomputeAll(state, lowDefault) {
    var balances = computeBalances(state.items, state.stockIn, state.stockOut);
    return {
      balances: balances,
      monthlyIn: monthlyPivot(state.stockIn),
      monthlyOut: monthlyPivot(state.stockOut),
      userWise: userWiseOut(state.stockOut),
      sectionWise: sectionWiseOut(state.stockOut),
      lowStock: lowStock(state.items, balances, lowDefault),
      trend: monthlyTrend(state.stockIn, state.stockOut, 12)
    };
  }

  return {
    num: num, isLive: isLive, monthOf: monthOf, reorderOf: reorderOf, isActiveMaster: isActiveMaster,
    computeBalances: computeBalances, balanceOf: balanceOf, monthlyPivot: monthlyPivot,
    groupOut: groupOut, userWiseOut: userWiseOut, sectionWiseOut: sectionWiseOut,
    lowStock: lowStock, topConsumers: topConsumers, monthlyTrend: monthlyTrend, recomputeAll: recomputeAll
  };
});
