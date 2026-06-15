/*
 * config.example.js — template. Copy to config.js and fill in API_URL.
 *
 * IMPORTANT: config.js is committed to the repo and served publicly.
 * It must NEVER contain the write secret / PIN. The PIN lives only in the
 * Apps Script "Script Properties" (WRITE_SECRET) and is given to staff
 * out-of-band. See README.md.
 */
window.APP_CONFIG = {
  // Google Apps Script Web App URL — must end with /exec (see README step 5).
  // Leave empty to run the UI in DEMO mode (in-memory sample data, no saving).
  API_URL: '',

  // Office identity — shown in the header and printed on issue slips.
  OFFICE_NAME_BN: 'পরিকল্পনা ও উন্নয়ন বিভাগ',
  OFFICE_NAME_EN: 'Planning & Development Division',
  APP_TITLE_BN: 'স্টেশনারি স্টক রেজিস্টার',
  APP_TITLE_EN: 'Stationery Stock Register',

  // Fallback low-stock threshold when an item has no reorder level set.
  LOW_STOCK_DEFAULT: 5,

  // Default UI language: 'bn' or 'en'.
  DEFAULT_LANG: 'bn',
};
