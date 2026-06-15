/*
 * demo-data.js — bundled sample data for DEMO mode (when config.js API_URL is empty).
 * Lets every screen render without a backend. Not used once API_URL is set.
 */
window.DEMO_DATA = (function () {
  const pad = (n, w) => { let s = String(n); while (s.length < w) s = '0' + s; return s; };

  const sections = [
    { section_id: 'SEC-01', name_bn: 'পরিকল্পনা ও উন্নয়ন', name_en: 'Planning & Development', sort_order: 1, active: 'TRUE' },
    { section_id: 'SEC-02', name_bn: 'পূর্ত কর্ম', name_en: 'Civil Works', sort_order: 2, active: 'TRUE' },
    { section_id: 'SEC-03', name_bn: 'নকশা ও পরিদর্শন', name_en: 'Design & Inspection', sort_order: 3, active: 'TRUE' },
    { section_id: 'SEC-04', name_bn: 'রেস্টহাউজ', name_en: 'Rest House', sort_order: 4, active: 'TRUE' }
  ];

  const userDefs = [
    ['এ.টি.এম তারিকুল ইসলাম', 'SEC-01'], ['প্রকৌঃ শহীদুল আলম', 'SEC-01'], ['মোঃ আলিউল আজম', 'SEC-01'],
    ['ফারিয়া হক পুষ্প', 'SEC-01'], ['অরিন মাহমুদ', 'SEC-01'], ['ফারজানা রিক্তা', 'SEC-01'],
    ['তাছনুবা জাহান ফারিয়া', 'SEC-01'], ['মো: কামাল উদ্দিন', 'SEC-02'], ['রবিউল ইসলাম', 'SEC-02'],
    ['নুরুন্নাহার নূপুর', 'SEC-02'], ['মাহিম মুতাসিম প্রিতম', 'SEC-02'], ['আহসান হাবিব', 'SEC-02'],
    ['মোঃ সাব্বির আহাম্মেদ', 'SEC-02'], ['কল্যান কুমার দেবনাথ', 'SEC-03'], ['ফয়সাল আহমেদ সৌরভ', 'SEC-03'],
    ['মোঃ কাউসার আলী', 'SEC-03'], ['খাদিজা সুলতানা', 'SEC-03'], ['মোঃ শাহাদাত হোসেন সাব্বির', 'SEC-03'],
    ['রুনা', 'SEC-01'], ['ফাতেমা', 'SEC-01'], ['রেস্টহাউজ', 'SEC-04'], ['শিপ্রা', 'SEC-01'], ['আরিফ', 'SEC-01']
  ];
  const users = userDefs.map((u, i) => ({ user_id: 'USR-' + pad(i + 1, 2), name_bn: u[0], designation: '', section_id: u[1], active: 'TRUE', created_at: '2026-06-15', created_by: 'seed', updated_at: '' }));

  const itemDefs = [
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
  ];
  // healthy default stock so the demo isn't all low; specific items overridden below
  const items = itemDefs.map((d, i) => ({
    item_id: 'ITM-' + pad(i + 1, 4), name_bn: d[0], name_en: d[0], unit: d[1], category: d[2],
    reorder_level: [5, 8, 10][i % 3], opening_balance: 20 + ((i * 13) % 80), spec: '',
    active: 'TRUE', created_at: '2026-06-15', created_by: 'seed', updated_at: ''
  }));
  const override = {
    'ITM-0003': { opening_balance: 20, reorder_level: 10 }, 'ITM-0008': { opening_balance: 40, reorder_level: 25 },
    'ITM-0009': { opening_balance: 30, reorder_level: 20 }, 'ITM-0016': { opening_balance: 8, reorder_level: 15 },
    'ITM-0029': { opening_balance: 10, reorder_level: 8 }, 'ITM-0036': { opening_balance: 6, reorder_level: 5 },
    'ITM-0043': { opening_balance: 4, reorder_level: 10 }, 'ITM-0032': { opening_balance: 50, reorder_level: 20 }
  };
  items.forEach((it) => { if (override[it.item_id]) Object.assign(it, override[it.item_id]); });

  const mo = (d) => d.slice(0, 7);
  const stockIn = [
    { date: '2026-04-05', item_id: 'ITM-0003', qty: 50, remarks: 'Q2 purchase' },
    { date: '2026-04-05', item_id: 'ITM-0008', qty: 100, remarks: '' },
    { date: '2026-04-05', item_id: 'ITM-0009', qty: 80, remarks: '' },
    { date: '2026-05-02', item_id: 'ITM-0016', qty: 20, remarks: '' },
    { date: '2026-05-02', item_id: 'ITM-0029', qty: 40, remarks: '' },
    { date: '2026-05-10', item_id: 'ITM-0036', qty: 15, remarks: '' },
    { date: '2026-06-01', item_id: 'ITM-0003', qty: 30, remarks: 'top-up' },
    { date: '2026-06-01', item_id: 'ITM-0043', qty: 24, remarks: '' },
    { date: '2026-06-03', item_id: 'ITM-0032', qty: 60, remarks: '' }
  ].map((r, i) => ({ txn_id: 'IN-' + r.date.replace(/-/g, '') + '-d' + pad(i + 1, 3), date: r.date, item_id: r.item_id, qty: r.qty, remarks: r.remarks, month: mo(r.date), status: 'active', created_at: r.date, created_by: 'seed' }));

  const secOf = {}; users.forEach((u) => { secOf[u.user_id] = u.section_id; });
  const outRaw = [
    { date: '2026-04-10', user_id: 'USR-01', item_id: 'ITM-0008', qty: 5 },
    { date: '2026-04-12', user_id: 'USR-04', item_id: 'ITM-0003', qty: 3 },
    { date: '2026-04-20', user_id: 'USR-08', item_id: 'ITM-0009', qty: 4 },
    { date: '2026-05-05', user_id: 'USR-11', item_id: 'ITM-0029', qty: 6 },
    { date: '2026-05-08', user_id: 'USR-14', item_id: 'ITM-0016', qty: 10 },
    { date: '2026-05-15', user_id: 'USR-01', item_id: 'ITM-0008', qty: 8 },
    { date: '2026-05-20', user_id: 'USR-17', item_id: 'ITM-0036', qty: 4 },
    { date: '2026-06-02', user_id: 'USR-21', item_id: 'ITM-0043', qty: 20 },
    { date: '2026-06-05', user_id: 'USR-04', item_id: 'ITM-0003', qty: 12 },
    { date: '2026-06-08', user_id: 'USR-08', item_id: 'ITM-0032', qty: 15 },
    { date: '2026-06-10', user_id: 'USR-11', item_id: 'ITM-0008', qty: 10 },
    { date: '2026-06-12', user_id: 'USR-14', item_id: 'ITM-0016', qty: 12 }
  ];
  const stockOut = outRaw.map((r, i) => ({ txn_id: 'OUT-' + r.date.replace(/-/g, '') + '-d' + pad(i + 1, 3), date: r.date, user_id: r.user_id, item_id: r.item_id, qty: r.qty, section_id: secOf[r.user_id] || '', month: mo(r.date), slip_no: 'SLP-' + pad(i + 1, 6), status: 'active', created_at: r.date, created_by: 'seed' }));

  const meta = { schema_version: '1', item_seq: items.length, user_seq: users.length, section_seq: sections.length, slip_seq: stockOut.length, low_stock_default: '5', office_name_bn: 'পরিকল্পনা ও উন্নয়ন বিভাগ', office_name_en: 'Planning & Development Division' };

  return { sections, items, users, stockIn, stockOut, meta };
})();
