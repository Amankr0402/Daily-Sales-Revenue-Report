/**
 * ============================================================
 *  Google Sheets Live Data Sync
 *  Fetches real-time sales records from Google Sheets, parses
 *  dates, agents, plans, and sources, and updates data/data.json
 * ============================================================
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = '1AMJ0DLL2JV9gl58h5yRPgTZyBzwSOL1cyrhpyA5Qz9c';
const SPREADSHEET_ID2 = '10j9ilpBqcVAyatDryXl5_33pducazaNOVOm-RYI9yV8';
const SHEET_NAME = 'Sales/Rev (Auto)';
const SECONDARY_SHEET_CACHE_FILE = path.join(__dirname, '..', 'data', 'secondary_sales_sheet.csv');
const REFUNDS_SPREADSHEET_ID = '1Q_IX-4CJK8_xr_7qicmhRQMOjIlLxHe0MBCS9bT-xnE';
const REFUNDS_SHEET_NAME = 'Refunds';
const REFUNDS_CACHE_FILE = path.join(__dirname, '..', 'data', 'refunds.csv');
const METABASE_URL = 'https://metabase-bkp.theelefant.ai/public/question/a7ec6872-1841-408d-8f63-7d16e959b67c.csv';
const DELIVERY_FEE_CSV = path.join(__dirname, '..', 'data', 'delivery_fees.csv');
const DELIVERY_FEE_METABASE_URL = 'https://metabase-bkp.theelefant.ai/public/question/93b699f2-7f1c-47a8-bf39-f3261a9e92da.csv';
const DIRECT_SALE_URL = 'https://metabase-bkp.theelefant.ai/public/question/37fddfd6-fc66-4c2b-91f6-70e47192334d.csv';
const MISSED_LEADS_URL = 'https://metabase-bkp.theelefant.ai/public/question/a2dc3828-0492-4009-85d1-ce6647dda724.csv';
const MISSED_LEADS_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/a213917a-7722-4459-8c47-d9c0335babec.csv';
const MISSED_LEADS_DETAILS_FILE = path.join(__dirname, '..', 'data', 'missed_leads_details.csv');
const APP_DOWNLOADS_URL = 'https://metabase-bkp.theelefant.ai/public/question/739c97ae-ef79-4088-ac33-67c4b37ba6fd.csv';
const TOTAL_ACTIVE_SUBS_URL = 'https://metabase-bkp.theelefant.ai/public/question/ef5cfe31-4213-43e8-8c8d-cbd876733e57.csv';
const ACTIVE_SUBS_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/06440078-3d94-4759-974e-0d4b59eccaa5.csv';
const ACTIVE_SUBS_DETAILS_FILE = path.join(__dirname, '..', 'data', 'active_subscriptions.csv');
const NEW_SUBS_7D_URL = 'https://metabase-bkp.theelefant.ai/public/question/9fc5c23c-8297-4511-8763-bdfb4036b7eb.csv';
const NEW_SUBS_7D_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/1fab800f-1d69-4e26-b356-418144d90443.csv';
const NEW_SUBS_7D_DETAILS_FILE = path.join(__dirname, '..', 'data', 'new_subs_7d_details.csv');
const NEW_USERS_7D_URL = 'https://metabase-bkp.theelefant.ai/public/question/40be1f89-570d-42b8-ab51-243e57425142.csv';
const NEW_USERS_YESTERDAY_URL = 'https://metabase-bkp.theelefant.ai/public/question/2a2bb684-0dd7-4b90-91d1-9e3de228e1b4.csv';
const TELECRM_LEADS_URL = 'https://metabase-bkp.theelefant.ai/public/question/30989a6b-c8d3-4e44-abc8-a03dbda8f55b.csv';
const SUBS_ENDING_5D_URL = 'https://metabase-bkp.theelefant.ai/public/question/51b44f84-76a4-4940-b075-f8362e426e01.csv';
const SUBS_EXPIRED_7D_URL = 'https://metabase-bkp.theelefant.ai/public/question/09dc0478-de41-4af1-982a-cfbb3a5c9cde.csv';
const SUBS_EXPIRING_TODAY_URL = 'https://metabase-bkp.theelefant.ai/public/question/2597639d-fdb9-41b4-a6c4-d3e458f92e2b.csv';
const PLAN_EXPIRING_NO_ORDER_URL = 'https://metabase-bkp.theelefant.ai/public/question/03c0f1ba-e346-4d1d-aaf8-02efdf36d12c.csv';
const PLAN_EXP_NO_ORDER_URL = 'https://metabase-bkp.theelefant.ai/public/question/3a786b1a-8b6e-4856-9f18-60949bc19d58.csv';
const ACTIVE_SUB_NO_ORDER_URL = 'https://metabase-bkp.theelefant.ai/public/question/fb796af2-6ed7-4c79-b39f-94f48aca3966.csv';
const NEW_USERS_DELIVERY_STATUS_URL = 'https://metabase-bkp.theelefant.ai/public/question/0b3450ef-d477-4a21-9038-73776a3904f4.csv';
const NEW_USERS_DELIVERY_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/46622b98-120c-473a-881b-d2aebe879fce.csv';
const NEW_USERS_DELIVERY_DETAILS_FILE = path.join(__dirname, '..', 'data', 'new_users_delivery_status_details.csv');
const ALL_NEW_USERS_ORDER_STATUS_URL = 'https://metabase-bkp.theelefant.ai/public/question/d88a76c5-bbde-4300-9421-8d86f9180a0d.csv';
const ALL_NEW_USERS_ORDER_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/e142aa5b-7f4f-433a-8540-28baec11c706.csv';
const ALL_NEW_USERS_ORDER_DETAILS_FILE = path.join(__dirname, '..', 'data', 'all_new_users_order_status_details.csv');
const APP_DOWNLOADS_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/e964576c-8d8c-4944-b859-57b166a13a1b.csv';
const APP_DOWNLOADS_DETAILS_FILE = path.join(__dirname, '..', 'data', 'app_downloads_details.csv');
const TELECRM_LEADS_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/b3f36132-e371-4fa0-a186-1302ceaa8a80.csv';
const TELECRM_LEADS_DETAILS_FILE = path.join(__dirname, '..', 'data', 'telecrm_leads_details.csv');
const SUBS_ENDING_5D_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/68f1530b-d09c-446e-b380-5da408fecf2a.csv';
const SUBS_ENDING_5D_DETAILS_FILE = path.join(__dirname, '..', 'data', 'subs_ending_5d_details.csv');
const SUBS_EXPIRED_7D_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/f2674048-51bb-43bf-beee-c6983651c727.csv';
const SUBS_EXPIRED_7D_DETAILS_FILE = path.join(__dirname, '..', 'data', 'subs_expired_7d_details.csv');
const SUBS_EXPIRING_TODAY_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/b7e9d453-fd39-4d31-81ce-330f4f5277cb.csv';
const SUBS_EXPIRING_TODAY_DETAILS_FILE = path.join(__dirname, '..', 'data', 'subs_expiring_today_details.csv');
const PLAN_EXP_NO_ORDER_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/debcc18f-227d-42ba-93ac-ce47f87e3b7c.csv';
const PLAN_EXP_NO_ORDER_DETAILS_FILE = path.join(__dirname, '..', 'data', 'plan_exp_no_order_details.csv');
const PLAN_EXPIRING_NO_ORDER_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/cec33372-48dd-44bf-8832-99b757075679.csv';
const PLAN_EXPIRING_NO_ORDER_DETAILS_FILE = path.join(__dirname, '..', 'data', 'plan_expiring_no_order_details.csv');
const ACTIVE_SUB_NO_ORDERS_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/d94cc795-d77d-477e-b61d-f96da7c2c6a7.csv';
const ACTIVE_SUB_NO_ORDERS_DETAILS_FILE = path.join(__dirname, '..', 'data', 'active_sub_no_orders_details.csv');
const DELIVERY_FEES_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/69801b76-ec6c-403d-bde2-0592f7463715.csv';
const DELIVERY_FEES_DETAILS_FILE = path.join(__dirname, '..', 'data', 'delivery_fees_details.csv');
const DIRECT_SALE_DETAILS_FILE = path.join(__dirname, '..', 'data', 'direct_sales_details.csv');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'data.json');

function fetchURLWithRedirect(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchURLWithRedirect(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function fetchSheetCSV(spreadsheetId, sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  return fetchURLWithRedirect(url);
}

function fetchMetabaseCSV() {
  return fetchURLWithRedirect(METABASE_URL);
}

function parseCSVLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseDate(rawDate) {
  if (!rawDate) return null;
  const clean = rawDate.replace(/"/g, '').trim();
  if (!clean) return null;

  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      let p1 = parseInt(parts[0], 10);
      let p2 = parseInt(parts[1], 10);
      let y = parts[2].trim();
      if (y.length === 2) y = '20' + y;

      let m, d;
      // If p1 > 12, it's definitely DD/MM/YYYY (e.g. 13/08/2026, 31/08/2026)
      if (p1 > 12) {
        d = p1;
        m = p2;
      }
      // If second part has leading zero and 2 digits like '08' or '09' (e.g. 12/08/2026)
      else if (parts[1].startsWith('0') && parts[1].length === 2) {
        d = p1;
        m = p2;
      }
      // If p1 is 8 or 9 (August or September in M/D/YYYY format like 8/1/2026 or 9/8/2026)
      else if (p1 === 8 || p1 === 9) {
        m = p1;
        d = p2;
      }
      // Fallback
      else {
        m = p1;
        d = p2;
      }
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return clean;
}

function formatDirectSalePlan(rawPlan, rawCycle) {
  const p = (rawPlan || '').trim();
  const bc = (rawCycle || '').trim().toUpperCase();

  let cyclePrefix = '';
  if (bc === 'ANNUALLY') cyclePrefix = 'Annual';
  else if (bc === 'QUARTERLY') cyclePrefix = 'Quarterly';
  else if (bc === 'SEMI_ANNUAL' || bc === 'SEMI_ANNUALLY' || bc === '6 MONTHS') cyclePrefix = '6 months';
  else if (bc === 'MONTHLY') cyclePrefix = 'Monthly';

  let tier = p;
  if (tier.toLowerCase().startsWith('play ')) {
    tier = tier.slice(5).trim();
  }

  if (tier.toLowerCase().includes('ultra')) {
    if (cyclePrefix === 'Quarterly') return 'Quarterly Ultra';
    return 'Ultra Annually';
  }

  if (cyclePrefix && tier) {
    return `${cyclePrefix} ${tier}`;
  }
  return p || 'Annual Max';
}

async function syncSalesData() {
  console.log(`📡 Fetching sales data from Google Sheet: "${SHEET_NAME}"...`);
  const sheetCSV = await fetchSheetCSV(SPREADSHEET_ID, SHEET_NAME);
  const sheetLines = sheetCSV.split('\n').map(l => l.trim()).filter(Boolean);

  if (sheetLines.length <= 1) {
    throw new Error('No records returned from sheet.');
  }

  console.log(`📊 Processing ${sheetLines.length} Google Sheet rows...`);
  const recordsByDate = {};
  const sheetPhonesByDate = {};

  // Skip header (row 0) and summary total row (row 1)
  for (let i = 2; i < sheetLines.length; i++) {
    const cols = parseCSVLine(sheetLines[i]).map(c => c.replace(/^"|"$/g, '').trim());
    const rawDate = cols[1];
    const phone = (cols[2] || '').replace(/\D/g, '').slice(-10);
    const agent = cols[3];
    const rawRev = cols[4];
    const plan = cols[6];
    const count = parseInt(cols[7], 10) || 1;
    const source = cols[8] || 'Organic';

    if (!agent || !rawRev || !rawDate) continue;
    const rev = parseFloat(rawRev.replace(/,/g, '')) || 0;
    if (rev <= 0) continue;

    const isoDate = parseDate(rawDate);
    if (!isoDate || isoDate.length !== 10) continue;

    if (!sheetPhonesByDate[isoDate]) sheetPhonesByDate[isoDate] = {};
    if (phone && phone.length >= 10) sheetPhonesByDate[isoDate][phone] = { agent, revenue: rev, customer: cols[5] || cols[0] || agent };

    if (!recordsByDate[isoDate]) {
      recordsByDate[isoDate] = {
        date: isoDate,
        totalRevenue: 0,
        salesCount: 0,
        transactions: 0,
        highestSale: { amount: 0, agent: null },
        agents: {},
        plans: {},
        sources: {},
        userBreakdown: null
      };
    }

    const day = recordsByDate[isoDate];
    day.totalRevenue += rev;
    day.salesCount += count;
    day.transactions += 1;

    // Track highest single sale
    const dealValue = count > 0 ? (rev / count) : rev;
    if (dealValue > day.highestSale.amount) {
      day.highestSale.amount = dealValue;
      day.highestSale.agent = agent || 'Unknown';
    }

    // Agents
    if (!day.agents[agent]) day.agents[agent] = { revenue: 0, count: 0 };
    day.agents[agent].revenue += rev;
    day.agents[agent].count += count;

    // Plans
    const cleanPlan = plan || 'Annual Max';
    if (!day.plans[cleanPlan]) day.plans[cleanPlan] = { revenue: 0, count: 0 };
    day.plans[cleanPlan].revenue += rev;
    day.plans[cleanPlan].count += count;

    // Sources
    const cleanSource = source || 'Organic';
    if (!day.sources[cleanSource]) day.sources[cleanSource] = { revenue: 0, count: 0 };
    day.sources[cleanSource].revenue += rev;
    day.sources[cleanSource].count += count;
  }

  // Fetch second Google Sheet (same format as Sheet 1)
  try {
    console.log(`📡 Fetching 2nd sales sheet data...`);
    const sheet2CSV = await fetchSheetCSV(SPREADSHEET_ID2, SHEET_NAME);
    if (sheet2CSV && sheet2CSV.length > 50) {
      fs.writeFileSync(SECONDARY_SHEET_CACHE_FILE, sheet2CSV, 'utf-8');
      console.log(`✅ Cached Secondary Sales Sheet to ${SECONDARY_SHEET_CACHE_FILE}`);
    }
    const sheet2Lines = sheet2CSV.split('\n').map(l => l.trim()).filter(Boolean);
    console.log(`📊 Processing ${sheet2Lines.length} rows from 2nd sheet...`);

    // Same format: row 0 = header, row 1 = summary total, row 2+ = data
    for (let i = 2; i < sheet2Lines.length; i++) {
      const cols = parseCSVLine(sheet2Lines[i]).map(c => c.replace(/^"|"$/g, '').trim());
      const rawDate = cols[1];
      const phone = (cols[2] || '').replace(/\D/g, '').slice(-10);
      const agent = cols[3];
      const rawRev = cols[4];
      const plan = cols[6];
      const count = parseInt(cols[7], 10) || 1;
      const source = cols[8] || 'Organic';

      if (!agent || !rawRev || !rawDate) continue;
      const rev = parseFloat(rawRev.replace(/,/g, '')) || 0;
      if (rev <= 0) continue;

      const isoDate = parseDate(rawDate);
      if (!isoDate || isoDate.length !== 10) continue;

      if (!sheetPhonesByDate[isoDate]) sheetPhonesByDate[isoDate] = {};
      if (phone && phone.length >= 10) sheetPhonesByDate[isoDate][phone] = { agent, revenue: rev, customer: cols[5] || cols[0] || agent };

      if (!recordsByDate[isoDate]) {
        recordsByDate[isoDate] = {
          date: isoDate, totalRevenue: 0, salesCount: 0, transactions: 0,
          highestSale: { amount: 0, agent: null },
          agents: {}, plans: {}, sources: {}, userBreakdown: null
        };
      }

      const day = recordsByDate[isoDate];
      day.totalRevenue += rev;
      day.salesCount += count;
      day.transactions += 1;

      const dealValue = count > 0 ? (rev / count) : rev;
      if (dealValue > day.highestSale.amount) {
        day.highestSale.amount = dealValue;
        day.highestSale.agent = agent;
      }

      if (!day.agents[agent]) day.agents[agent] = { revenue: 0, count: 0 };
      day.agents[agent].revenue += rev;
      day.agents[agent].count += count;

      const cleanPlan = plan || 'Annual Max';
      if (!day.plans[cleanPlan]) day.plans[cleanPlan] = { revenue: 0, count: 0 };
      day.plans[cleanPlan].revenue += rev;
      day.plans[cleanPlan].count += count;

      const cleanSource = source || 'Organic';
      if (!day.sources[cleanSource]) day.sources[cleanSource] = { revenue: 0, count: 0 };
      day.sources[cleanSource].revenue += rev;
      day.sources[cleanSource].count += count;
    }
  } catch (sheet2Err) {
    console.warn('⚠️ Warning: Could not fetch 2nd sheet:', sheet2Err.message);
  }

  // Fetch Direct Sale Data
  try {
    console.log('🛍️ Fetching Direct Sale data from Metabase...');
    const dsCSV = await fetchURLWithRedirect(DIRECT_SALE_URL);
    try {
      fs.writeFileSync(DIRECT_SALE_DETAILS_FILE, dsCSV, 'utf8');
      console.log('🛍️ Cached Direct Sale CSV to data/direct_sales_details.csv');
    } catch (saveErr) {
      console.warn('⚠️ Could not cache direct_sales_details.csv:', saveErr.message);
    }
    const dsLines = dsCSV.split('\n').map(l => l.trim()).filter(Boolean);
    console.log(`🛍️ Processing ${dsLines.length - 1} Direct Sale rows...`);
    for (let i = 1; i < dsLines.length; i++) {
      const cols = parseCSVLine(dsLines[i]).map(c => c.replace(/^"|"$/g, '').trim());
      const rawDate = cols[8]; // Payment Date, e.g. 02/09/2026 11:31
      if (!rawDate) continue;
      const datePart = rawDate.split(' ')[0];
      const dParts = datePart.split('/');
      if (dParts.length !== 3) continue;
      const isoDate = `${dParts[2]}-${dParts[1]}-${dParts[0]}`; // YYYY-MM-DD
      const rev = parseFloat(cols[7]) || 0; // Amount Paid
      if (rev <= 0) continue;

      if (!recordsByDate[isoDate]) {
        recordsByDate[isoDate] = {
          date: isoDate, totalRevenue: 0, salesCount: 0, transactions: 0,
          highestSale: { amount: 0, agent: null },
          agents: {}, plans: {}, sources: {}, userBreakdown: null
        };
      }

      const day = recordsByDate[isoDate];
      if (!day.directSaleCSV) {
        day.directSaleCSV = { count: 0, revenue: 0 };
      }
      day.directSaleCSV.count += 1;
      day.directSaleCSV.revenue += rev;
      const phone = (cols[2] || '').replace(/\D/g, '').slice(-10);

      // Deduplicate: If this customer's deal was already logged by an agent in Google Sheets on this date, record collision and skip to avoid double counting!
      if (phone && sheetPhonesByDate[isoDate] && sheetPhonesByDate[isoDate][phone]) {
        const inside = sheetPhonesByDate[isoDate][phone];
        if (!day.collidingDeals) day.collidingDeals = [];
        day.collidingDeals.push({
          customerName: cols[1] || inside.customer || 'Unknown',
          agent: inside.agent || 'Unknown',
          revenue: rev,
          insideRevenue: inside.revenue || 0,
          phone
        });
        if (!day.collidingTotal) day.collidingTotal = { count: 0, revenue: 0 };
        day.collidingTotal.count += 1;
        day.collidingTotal.revenue += rev;
        continue;
      }

      day.totalRevenue += rev;
      day.salesCount += 1;
      day.transactions += 1;

      if (rev > day.highestSale.amount) {
        day.highestSale.amount = rev;
        day.highestSale.agent = cols[1] || 'Unknown'; // User Name as agent for direct sale
      }

      const cleanSource = 'Direct Sale';
      if (!day.sources[cleanSource]) day.sources[cleanSource] = { revenue: 0, count: 0 };
      day.sources[cleanSource].revenue += rev;
      day.sources[cleanSource].count += 1;

      // Populate Plan Distribution for Direct Sale
      const rawPlan = cols[4] || '';
      const rawCycle = cols[5] || '';
      const cleanPlan = formatDirectSalePlan(rawPlan, rawCycle);
      if (!day.plans[cleanPlan]) day.plans[cleanPlan] = { revenue: 0, count: 0 };
      day.plans[cleanPlan].revenue += rev;
      day.plans[cleanPlan].count += 1;
    }
  } catch (dsErr) {
    console.warn(`⚠️ Warning: Could not fetch Direct Sale data:`, dsErr.message);
  }

  // Fetch Metabase User Breakdown CSV
  try {
    console.log(`🌐 Fetching D-o-D User Breakdown from Metabase...`);
    const metabaseCSV = await fetchMetabaseCSV();
    const metaLines = metabaseCSV.split('\n').map(l => l.trim()).filter(Boolean);
    console.log(`📈 Processing ${metaLines.length} Metabase User Breakdown rows...`);

    // Row 0 is header: Date,Signups,Total OTP Verified Users,Serviceable,Rate
    for (let i = 1; i < metaLines.length; i++) {
      const cols = parseCSVLine(metaLines[i]).map(c => c.replace(/^"|"$/g, '').trim());
      const rawDay = cols[0];
      if (!rawDay) continue;

      const signups = parseInt(cols[1], 10) || 0;
      const otpVerified = parseInt(cols[2], 10) || 0;
      const serviceable = parseInt(cols[3], 10) || 0;
      const rateStr = cols[4] ? parseFloat(cols[4]).toFixed(1) + '%' : '0%';
      const serviceablePct = signups > 0 ? ((serviceable / signups) * 100).toFixed(1) + '%' : '0%';

      const userBreakdown = {
        signups,
        otpVerified,
        serviceable,
        serviceableWithPct: `${serviceable.toLocaleString('en-IN')} (${serviceablePct})`,
        serviceablePct: rateStr // use rate from Metabase or calculated
      };

      // Create a day entry even if no sales data exists for this date
      if (!recordsByDate[rawDay]) {
        recordsByDate[rawDay] = {
          date: rawDay,
          totalRevenue: 0,
          salesCount: 0,
          transactions: 0,
          agents: {},
          plans: {},
          sources: {},
          userBreakdown: null
        };
      }
      recordsByDate[rawDay].userBreakdown = userBreakdown;
    }
  } catch (metaErr) {
    console.warn(`⚠️ Warning: Could not fetch Metabase User Breakdown:`, metaErr.message);
  }

  // Fetch Delivery Fees from Metabase
  try {
    console.log('🚚 Fetching Delivery Fee data from Metabase...');
    const deliveryCSV = await fetchURLWithRedirect(DELIVERY_FEE_METABASE_URL);
    const dLines = deliveryCSV.split('\n').map(l => l.trim()).filter(Boolean);
    let attachedCount = 0;

    // Skip header row, parse each data row
    for (let i = 1; i < dLines.length; i++) {
      const dCols = parseCSVLine(dLines[i]).map(c => c.replace(/^"|"$/g, '').trim());
      if (dCols.length < 5) continue;

      const dateKey = parseDate(dCols[0]);  // parse transaction_date
      if (!dateKey || dateKey.length !== 10) continue;

      const deliveryFee = {
        transactions: parseInt(dCols[1], 10) || 0,
        charge: parseFloat(dCols[2]) || 0,
        tax: parseFloat(dCols[3]) || 0,
        total: parseFloat(dCols[4]) || 0
      };

      if (deliveryFee.total > 0 && recordsByDate[dateKey]) {
        recordsByDate[dateKey].deliveryFee = deliveryFee;
        console.log(`✅ Delivery fee attached to ${dateKey}: ₹${deliveryFee.total} (${deliveryFee.transactions} txns)`);
        attachedCount++;
      }
    }
    if (attachedCount === 0) console.log('ℹ️  No delivery fee rows matched existing dates.');
  } catch (delErr) {
    console.warn('⚠️ Warning: Could not fetch Delivery Fee CSV:', delErr.message);
  }

  // Fetch Missed Leads from Metabase
  try {
    console.log('🎯 Fetching Missed Leads data from Metabase...');
    const missedCSV = await fetchURLWithRedirect(MISSED_LEADS_URL);
    const mLines = missedCSV.split('\n').map(l => l.trim()).filter(Boolean);
    const missedLeads = {};
    for (let i = 1; i < mLines.length; i++) {
      const mCols = parseCSVLine(mLines[i]).map(c => c.replace(/^"|"$/g, '').trim());
      if (mCols.length >= 2) {
        missedLeads[mCols[0]] = parseInt(mCols[1], 10) || 0;
      }
    }

    // Attach to yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yyyymmdd = yesterday.toISOString().split('T')[0];
    const targetKey = recordsByDate[yyyymmdd] ? yyyymmdd : Object.keys(recordsByDate).sort().slice(-1)[0];
    if (targetKey) {
      recordsByDate[targetKey].missedLeads = missedLeads;
      console.log(`✅ Missed Leads attached to ${targetKey}`);
    }
  } catch (missErr) {
    console.warn('⚠️ Warning: Could not fetch Missed Leads:', missErr.message);
  }

  // Fetch Refunds Google Sheet
  try {
    console.log(`💸 Fetching Refunds data from Google Sheet: "${REFUNDS_SHEET_NAME}"...`);
    const refundsCSV = await fetchSheetCSV(REFUNDS_SPREADSHEET_ID, REFUNDS_SHEET_NAME);
    if (refundsCSV && refundsCSV.length > 50) {
      fs.writeFileSync(REFUNDS_CACHE_FILE, refundsCSV, 'utf-8');
      console.log(`✅ Cached Refunds CSV to ${REFUNDS_CACHE_FILE}`);
    }
    const refLines = refundsCSV.split('\n').map(l => l.trim()).filter(Boolean);
    console.log(`📊 Processing ${Math.max(0, refLines.length - 1)} Refunds rows...`);

    for (let i = 1; i < refLines.length; i++) {
      const cols = parseCSVLine(refLines[i]).map(c => c.replace(/^"|"$/g, '').trim());
      // Header: Received At(0), Event(1), Refund ID(2), Payment ID(3), Amount(4), Currency(5), Status(6), ..., Refund Created At(13)
      const rawDate = cols[13] || cols[0];
      if (!rawDate) continue;

      let isoDate = null;
      if (rawDate.includes('T')) {
        isoDate = rawDate.split('T')[0];
      } else if (rawDate.includes(' ')) {
        const dPart = rawDate.split(' ')[0];
        if (dPart.includes('/')) {
          const parts = dPart.split('/');
          if (parts.length === 3) {
            isoDate = `${parts[2]}-${String(parts[1]).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
          }
        } else if (dPart.includes('-')) {
          isoDate = dPart;
        }
      } else if (rawDate.includes('/')) {
        const parts = rawDate.split('/');
        if (parts.length === 3) {
          isoDate = `${parts[2]}-${String(parts[1]).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
        }
      }

      if (!isoDate || isoDate.length !== 10) continue;

      const rawAmount = parseFloat((cols[4] || '').replace(/,/g, '')) || 0;
      const status = (cols[6] || 'processed').toLowerCase();

      if (!recordsByDate[isoDate]) {
        recordsByDate[isoDate] = {
          date: isoDate,
          totalRevenue: 0,
          salesCount: 0,
          transactions: 0,
          highestSale: { amount: 0, agent: null },
          agents: {},
          plans: {},
          sources: {},
          userBreakdown: null
        };
      }

      if (!recordsByDate[isoDate].refunds) {
        recordsByDate[isoDate].refunds = { count: 0, total: 0, items: [] };
      }

      recordsByDate[isoDate].refunds.count += 1;
      recordsByDate[isoDate].refunds.total += rawAmount;
      recordsByDate[isoDate].refunds.items.push({
        refundId: cols[2],
        paymentId: cols[3],
        amount: rawAmount,
        status,
        date: rawDate
      });
    }
  } catch (refErr) {
    console.warn('⚠️ Warning: Could not fetch Refunds data:', refErr.message);
  }

  const sortedDays = Object.values(recordsByDate).sort((a, b) => a.date.localeCompare(b.date));

  // Compute rolling 7-day refunds for each day
  for (let i = 0; i < sortedDays.length; i++) {
    const startIdx = Math.max(0, i - 6);
    let r7Total = 0;
    let r7Count = 0;
    for (let j = startIdx; j <= i; j++) {
      if (sortedDays[j].refunds) {
        r7Total += sortedDays[j].refunds.total || 0;
        r7Count += sortedDays[j].refunds.count || 0;
      }
    }
    sortedDays[i].refundsLast7Days = { total: r7Total, count: r7Count };
    if (!sortedDays[i].refunds) {
      sortedDays[i].refunds = { count: 0, total: 0, items: [] };
    }
  }

  function getTargetDays(days) {
    const dates = new Set();
    const d1 = new Date();
    d1.setDate(d1.getDate() - 1);
    dates.add(d1.toISOString().split('T')[0]);

    const now = Date.now();
    const ist = new Date(now + (5.5 * 60 * 60 * 1000));
    ist.setDate(ist.getDate() - 1);
    const y = ist.getUTCFullYear();
    const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
    const d = String(ist.getUTCDate()).padStart(2, '0');
    dates.add(`${y}-${m}-${d}`);

    const withSales = days.filter(x => (x.salesCount || 0) > 0 || (x.totalRevenue || 0) > 0);
    if (withSales.length > 0) {
      dates.add(withSales[withSales.length - 1].date);
    }

    const targets = [];
    for (const dt of dates) {
      const found = days.find(x => x.date === dt);
      if (found && !targets.includes(found)) targets.push(found);
    }
    if (targets.length === 0 && days.length > 0) {
      targets.push(days[days.length - 1]);
    }
    return targets;
  }

  // Fetch New user in last 7 days (app downloads) — direct count from Metabase (40be1f89)
  try {
    console.log(`📱 Fetching New Users (7d, app downloads) from Metabase...`);
    const nu7dCSV = await fetchURLWithRedirect(NEW_USERS_7D_URL);
    const nu7dLines = nu7dCSV.split('\n').map(l => l.trim()).filter(Boolean);
    if (nu7dLines.length > 1 && sortedDays.length > 0) {
      const cols = parseCSVLine(nu7dLines[1]).map(c => c.replace(/^"|"$/g, '').trim());
      const newUsers7d = parseInt(cols[0], 10);
      if (!isNaN(newUsers7d)) {
        getTargetDays(sortedDays).forEach(targetDay => {
          targetDay.newUsers7d = newUsers7d;
          console.log(`✅ New Users (7d, app downloads): ${newUsers7d} attached to ${targetDay.date}`);
        });
      }
    }
  } catch (appErr) {
    console.warn('⚠️ Warning: Could not process New Users (7d) from Metabase:', appErr.message);
  }

  // Fetch New user yesterday (app downloads) — calculated from details list to match app-downloads-details.html
  try {
    console.log(`📱 Calculating New Users (yesterday, app downloads) from Details list...`);
    let appDlCSV = '';
    if (fs.existsSync(APP_DOWNLOADS_DETAILS_FILE)) {
      appDlCSV = fs.readFileSync(APP_DOWNLOADS_DETAILS_FILE, 'utf-8');
    }
    if (!appDlCSV || appDlCSV.length < 50) {
      appDlCSV = await fetchURLWithRedirect(APP_DOWNLOADS_DETAILS_URL);
      fs.writeFileSync(APP_DOWNLOADS_DETAILS_FILE, appDlCSV, 'utf-8');
    }

    if (appDlCSV && appDlCSV.length > 50 && !appDlCSV.includes('HTTP ERROR 500')) {
      const allLines = appDlCSV.split('\n').filter(Boolean);
      const headerCols = parseCSVLine(allLines[0]).map(h => h.trim().toLowerCase());
      const createdIdx = headerCols.indexOf('created_at');
      const dateCounts = {};
      for (let i = 1; i < allLines.length; i++) {
        const c = parseCSVLine(allLines[i]);
        const created = c[createdIdx] || '';
        if (created) {
          const dPart = created.split('T')[0];
          dateCounts[dPart] = (dateCounts[dPart] || 0) + 1;
        }
      }
      const availDates = Object.keys(dateCounts).sort().reverse();
      const latestDateStr = availDates[0] || '';
      const yesterdayCount = dateCounts[latestDateStr] || 0;

      if (yesterdayCount > 0) {
        getTargetDays(sortedDays).forEach(targetDay => {
          targetDay.newUsersYesterday = yesterdayCount;
          console.log(`✅ New Users (yesterday, app downloads) from Details (${latestDateStr}): ${yesterdayCount} attached to ${targetDay.date}`);
        });
      }
    }
  } catch (appErr) {
    console.warn('⚠️ Warning: Could not process New Users (yesterday) from Details list:', appErr.message);
  }

  // Fetch Total Active Subscriptions from Metabase (ef5cfe31)
  try {
    console.log(`📡 Fetching Total Active Subscriptions from Metabase...`);
    const activeSubsCSV = await fetchURLWithRedirect(TOTAL_ACTIVE_SUBS_URL);
    const activeSubsLines = activeSubsCSV.split('\n').map(l => l.trim()).filter(Boolean);
    if (activeSubsLines.length > 1 && sortedDays.length > 0) {
      const cols = parseCSVLine(activeSubsLines[1]).map(c => c.replace(/^"|"$/g, '').trim());
      const totalActiveSubs = parseInt(cols[0], 10);
      if (!isNaN(totalActiveSubs)) {
        getTargetDays(sortedDays).forEach(targetDay => {
          targetDay.activeSubs = totalActiveSubs;
          console.log(`✅ Total Active Subs: ${totalActiveSubs} attached to ${targetDay.date}`);
        });
      }
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not process Total Active Subscriptions:', err.message);
  }

  // Fetch New Subscribers in last 7 days directly from Metabase (9fc5c23c)
  try {
    console.log(`📡 Fetching New Subscribers in last 7 days from Metabase (${NEW_SUBS_7D_URL})...`);
    const newSubsCSV = await fetchURLWithRedirect(NEW_SUBS_7D_URL);
    const newSubsLines = newSubsCSV.split('\n').map(l => l.trim()).filter(Boolean);
    if (newSubsLines.length > 1 && sortedDays.length > 0) {
      const cols = parseCSVLine(newSubsLines[1]).map(c => c.replace(/^"|"$/g, '').trim());
      const newSubs7d = parseInt(cols[0], 10);
      if (!isNaN(newSubs7d)) {
        getTargetDays(sortedDays).forEach(targetDay => {
          targetDay.newSubs7d = newSubs7d;
          console.log(`✅ New Subs (7d) from Metabase: ${newSubs7d} attached to ${targetDay.date}`);
        });
      }
    }
  } catch (subsErr) {
    console.warn('⚠️ Warning: Could not fetch New Subscribers (7d) from Metabase:', subsErr.message);
  }

  // Fallback: calculate New Subscribers in last 7 days from verified sales data if not populated
  getTargetDays(sortedDays).forEach(targetDay => {
    if (targetDay.newSubs7d === undefined) {
      const l7 = sortedDays.filter(d => d.date <= targetDay.date).slice(-7);
      const sum = l7.reduce((acc, d) => {
        const sources = d.sources || {};
        const newFromSources = Object.entries(sources).reduce((s, [src, val]) => {
          if (!/renewal|upgrade/i.test(src)) return s + (val.count || 0);
          return s;
        }, 0);
        return acc + newFromSources;
      }, 0);
      targetDay.newSubs7d = sum;
      console.log(`ℹ️ New Subs (7d) calculated from sales data: ${sum} attached to ${targetDay.date}`);
    }
  });

  // Fetch Total TeleCRM Leads Generated yesterday (30989a6b)
  try {
    console.log(`📞 Fetching TeleCRM Leads (yesterday) from Metabase...`);
    const teleCrmCSV = await fetchURLWithRedirect(TELECRM_LEADS_URL);
    const teleCrmLines = teleCrmCSV.split('\n').map(l => l.trim()).filter(Boolean);
    if (teleCrmLines.length > 1 && sortedDays.length > 0) {
      const cols = parseCSVLine(teleCrmLines[1]).map(c => c.replace(/^"|"$/g, '').trim());
      const teleCrmLeads = parseInt(cols[0], 10);
      if (!isNaN(teleCrmLeads)) {
        getTargetDays(sortedDays).forEach(targetDay => {
          targetDay.teleCrmLeads = teleCrmLeads;
          console.log(`✅ TeleCRM Leads (yesterday): ${teleCrmLeads} attached to ${targetDay.date}`);
        });
      }
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not process TeleCRM Leads from Metabase:', err.message);
  }

  // Fetch Subscription ending in next 5 days (51b44f84)
  try {
    console.log(`📅 Fetching Subscriptions Ending (next 5d) from Metabase...`);
    const subs5dCSV = await fetchURLWithRedirect(SUBS_ENDING_5D_URL);
    const subs5dLines = subs5dCSV.split('\n').map(l => l.trim()).filter(Boolean);
    if (subs5dLines.length > 1 && sortedDays.length > 0) {
      const cols = parseCSVLine(subs5dLines[1]).map(c => c.replace(/^"|"$/g, '').trim());
      const subsEnding5d = parseInt(cols[0], 10);
      if (!isNaN(subsEnding5d)) {
        getTargetDays(sortedDays).forEach(targetDay => {
          targetDay.subsEnding5d = subsEnding5d;
          console.log(`✅ Subs Ending (next 5d): ${subsEnding5d} attached to ${targetDay.date}`);
        });
      }
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not process Subs Ending 5d from Metabase:', err.message);
  }

  // Fetch Subscription expired / cancelled in last 7 days (09dc0478)
  try {
    console.log(`📅 Fetching Subscriptions Expired/Cancelled (last 7d) from Metabase...`);
    const subsExp7dCSV = await fetchURLWithRedirect(SUBS_EXPIRED_7D_URL);
    const subsExp7dLines = subsExp7dCSV.split('\n').map(l => l.trim()).filter(Boolean);
    if (subsExp7dLines.length > 1 && sortedDays.length > 0) {
      const cols = parseCSVLine(subsExp7dLines[1]).map(c => c.replace(/^"|"$/g, '').trim());
      const subsExpired7d = parseInt(cols[0], 10);
      if (!isNaN(subsExpired7d)) {
        getTargetDays(sortedDays).forEach(targetDay => {
          targetDay.subsExpired7d = subsExpired7d;
          console.log(`✅ Subs Expired/Cancelled (last 7d): ${subsExpired7d} attached to ${targetDay.date}`);
        });
      }
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not process Subs Expired/Cancelled 7d from Metabase:', err.message);
  }

  // Fetch Subscription expiring today (2597639d)
  try {
    console.log(`📅 Fetching Subscriptions Expiring Today from Metabase...`);
    const subsExpTodayCSV = await fetchURLWithRedirect(SUBS_EXPIRING_TODAY_URL);
    const subsExpTodayLines = subsExpTodayCSV.split('\n').map(l => l.trim()).filter(Boolean);
    if (subsExpTodayLines.length > 1 && sortedDays.length > 0) {
      const cols = parseCSVLine(subsExpTodayLines[1]).map(c => c.replace(/^"|"$/g, '').trim());
      const subsExpiringToday = parseInt(cols[0], 10);
      if (!isNaN(subsExpiringToday)) {
        getTargetDays(sortedDays).forEach(targetDay => {
          targetDay.subsExpiringToday = subsExpiringToday;
          console.log(`✅ Subs Expiring Today: ${subsExpiringToday} attached to ${targetDay.date}`);
        });
      }
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not process Subs Expiring Today from Metabase:', err.message);
  }

  // Fetch Plan expiring and not placed a single order (03c0f1ba)
  try {
    console.log(`📦 Fetching Plan Expiring No Order from Metabase...`);
    const planExpCSV = await fetchURLWithRedirect(PLAN_EXPIRING_NO_ORDER_URL);
    const planExpLines = planExpCSV.split('\n').map(l => l.trim()).filter(Boolean);
    if (planExpLines.length > 1 && sortedDays.length > 0) {
      const cols = parseCSVLine(planExpLines[1]).map(c => c.replace(/^"|"$/g, '').trim());
      const planExpiringNoOrder = parseInt(cols[0], 10);
      if (!isNaN(planExpiringNoOrder)) {
        getTargetDays(sortedDays).forEach(targetDay => {
          targetDay.planExpiringNoOrder = planExpiringNoOrder;
          console.log(`✅ Plan Expiring No Order: ${planExpiringNoOrder} attached to ${targetDay.date}`);
        });
      }
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not process Plan Expiring No Order from Metabase:', err.message);
  }

  // Fetch Plan expired and not a single order placed (3a786b1a)
  try {
    console.log(`📦 Fetching Plan Expired No Order from Metabase...`);
    const planExpNoOrdCSV = await fetchURLWithRedirect(PLAN_EXP_NO_ORDER_URL);
    const planExpNoOrdLines = planExpNoOrdCSV.split('\n').map(l => l.trim()).filter(Boolean);
    if (planExpNoOrdLines.length > 1 && sortedDays.length > 0) {
      const cols = parseCSVLine(planExpNoOrdLines[1]).map(c => c.replace(/^"|"$/g, '').trim());
      const planExpNoOrder = parseInt(cols[0], 10);
      if (!isNaN(planExpNoOrder)) {
        getTargetDays(sortedDays).forEach(targetDay => {
          targetDay.planExpNoOrder = planExpNoOrder;
          console.log(`✅ Plan Expired No Order: ${planExpNoOrder} attached to ${targetDay.date}`);
        });
      }
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not process Plan Expired No Order from Metabase:', err.message);
  }

  // Fetch Active subscriber & no orders placed yet (fb796af2)
  try {
    console.log(`📦 Fetching Active Sub No Order from Metabase...`);
    const actSubNoOrdCSV = await fetchURLWithRedirect(ACTIVE_SUB_NO_ORDER_URL);
    const actSubNoOrdLines = actSubNoOrdCSV.split('\n').map(l => l.trim()).filter(Boolean);
    if (actSubNoOrdLines.length > 1 && sortedDays.length > 0) {
      const cols = parseCSVLine(actSubNoOrdLines[1]).map(c => c.replace(/^"|"$/g, '').trim());
      const activeSubNoOrder = parseInt(cols[0], 10);
      if (!isNaN(activeSubNoOrder)) {
        getTargetDays(sortedDays).forEach(targetDay => {
          targetDay.activeSubNoOrder = activeSubNoOrder;
          console.log(`✅ Active Sub No Order: ${activeSubNoOrder} attached to ${targetDay.date}`);
        });
      }
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not process Active Sub No Order from Metabase:', err.message);
  }

  // Fetch New Users Delivery Status (0b3450ef)
  try {
    console.log(`🚚 Fetching New Users Delivery Status from Metabase...`);
    const delivCSV = await fetchURLWithRedirect(NEW_USERS_DELIVERY_STATUS_URL);
    const delivLines = delivCSV.split('\n').map(l => l.trim()).filter(Boolean);
    if (delivLines.length > 1 && sortedDays.length > 0) {
      const deliveryStatus = {};
      for (let i = 1; i < delivLines.length; i++) {
        const parts = parseCSVLine(delivLines[i]).map(c => c.replace(/^"|"$/g, '').trim());
        if (parts.length >= 2) {
          const rowName = parts[0];
          const count = parseInt(parts[1], 10);
          const val = isNaN(count) ? 0 : count;
          deliveryStatus[rowName] = val;

          if (/placed/i.test(rowName)) deliveryStatus['Orders Placed'] = val;
          if (/confirmed/i.test(rowName)) deliveryStatus['Orders Confirmed'] = val;
          if (/ready_to_ship|ready to ship/i.test(rowName)) deliveryStatus['Orders Ready to Ship'] = val;
          if (/shipped/i.test(rowName) && !/ready/i.test(rowName)) deliveryStatus['Orders Shipped'] = val;
        }
      }
      if (deliveryStatus['Orders Not Delivered'] === undefined) {
        deliveryStatus['Orders Not Delivered'] = (deliveryStatus['Orders Placed'] || 0) +
          (deliveryStatus['Orders Confirmed'] || 0) +
          (deliveryStatus['Orders Ready to Ship'] || 0) +
          (deliveryStatus['Orders Shipped'] || 0);
      }
      getTargetDays(sortedDays).forEach(targetDay => {
        targetDay.newUsersDeliveryStatus = deliveryStatus;
        console.log(`✅ New Users Delivery Status attached to ${targetDay.date}:`, JSON.stringify(deliveryStatus));
      });
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not process New Users Delivery Status from Metabase:', err.message);
  }

  // Fetch and cache New Users Delivery Status Detailed Records (46622b98)
  try {
    console.log(`🚚 Fetching New Users Delivery Status Detailed List from Metabase...`);
    const delivDetailsCSV = await fetchURLWithRedirect(NEW_USERS_DELIVERY_DETAILS_URL);
    if (delivDetailsCSV && delivDetailsCSV.length > 50) {
      fs.writeFileSync(NEW_USERS_DELIVERY_DETAILS_FILE, delivDetailsCSV, 'utf-8');
      console.log(`✅ Cached New Users Delivery Status details (${delivDetailsCSV.split('\n').filter(Boolean).length - 1} records) to ${NEW_USERS_DELIVERY_DETAILS_FILE}`);
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not cache New Users Delivery Status details from Metabase:', err.message);
  }

  // Fetch User Order and Delivery Status of all New Users (d88a76c5)
  try {
    console.log(`📦 Fetching User Order and Delivery Status of all New Users from Metabase...`);
    const allNuCSV = await fetchURLWithRedirect(ALL_NEW_USERS_ORDER_STATUS_URL);
    const allNuLines = allNuCSV.split('\n').map(l => l.trim()).filter(Boolean);
    if (allNuLines.length > 1 && sortedDays.length > 0) {
      const orderStatus = {};
      for (let i = 1; i < allNuLines.length; i++) {
        const parts = parseCSVLine(allNuLines[i]).map(c => c.replace(/^"|"$/g, '').trim());
        if (parts.length >= 2) {
          const rowName = parts[0];
          const count = parseInt(parts[1], 10);
          orderStatus[rowName] = isNaN(count) ? 0 : count;
        }
      }
      getTargetDays(sortedDays).forEach(targetDay => {
        targetDay.allNewUsersOrderStatus = orderStatus;
        console.log(`✅ All New Users Order Status attached to ${targetDay.date}:`, JSON.stringify(orderStatus));
      });
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not process All New Users Order Status from Metabase:', err.message);
  }

  // Fetch and cache User Order and Delivery Status of all New Users Detailed Records (e142aa5b)
  try {
    console.log(`📦 Fetching User Order & Delivery Status Detailed List for All New Users from Metabase...`);
    const allNuDetailsCSV = await fetchURLWithRedirect(ALL_NEW_USERS_ORDER_DETAILS_URL);
    if (allNuDetailsCSV && allNuDetailsCSV.length > 50 && !allNuDetailsCSV.includes('HTTP ERROR 500')) {
      fs.writeFileSync(ALL_NEW_USERS_ORDER_DETAILS_FILE, allNuDetailsCSV, 'utf-8');
      console.log(`✅ Cached All New Users Order Status details (${allNuDetailsCSV.split('\n').filter(Boolean).length - 1} records) to ${ALL_NEW_USERS_ORDER_DETAILS_FILE}`);
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not cache All New Users Order Status details from Metabase:', err.message);
  }

  // Fetch and cache App Downloads / New Users Details (e964576c)
  try {
    console.log(`📱 Fetching App Downloads / New Users Detailed List from Metabase...`);
    const appDlDetailsCSV = await fetchURLWithRedirect(APP_DOWNLOADS_DETAILS_URL);
    if (appDlDetailsCSV && appDlDetailsCSV.length > 50 && !appDlDetailsCSV.includes('HTTP ERROR 500')) {
      fs.writeFileSync(APP_DOWNLOADS_DETAILS_FILE, appDlDetailsCSV, 'utf-8');
      console.log(`✅ Cached App Downloads details (${appDlDetailsCSV.split('\n').filter(Boolean).length - 1} records) to ${APP_DOWNLOADS_DETAILS_FILE}`);
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not cache App Downloads details from Metabase:', err.message);
  }

  // Fetch and cache TeleCRM Leads Details (b3f36132)
  try {
    console.log(`📞 Fetching TeleCRM Leads Detailed List from Metabase...`);
    const telecrmDetailsCSV = await fetchURLWithRedirect(TELECRM_LEADS_DETAILS_URL);
    if (telecrmDetailsCSV && telecrmDetailsCSV.length > 50 && !telecrmDetailsCSV.includes('HTTP ERROR 500')) {
      fs.writeFileSync(TELECRM_LEADS_DETAILS_FILE, telecrmDetailsCSV, 'utf-8');
      console.log(`✅ Cached TeleCRM Leads details (${telecrmDetailsCSV.split('\n').filter(Boolean).length - 1} records) to ${TELECRM_LEADS_DETAILS_FILE}`);
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not cache TeleCRM Leads details from Metabase:', err.message);
  }

  // Fetch and cache Subscriptions Ending in Next 5 Days Details (68f1530b)
  try {
    console.log(`📅 Fetching Subscriptions Ending (Next 5 Days) Detailed List from Metabase...`);
    const subs5dDetailsCSV = await fetchURLWithRedirect(SUBS_ENDING_5D_DETAILS_URL);
    if (subs5dDetailsCSV && subs5dDetailsCSV.length > 50 && !subs5dDetailsCSV.includes('HTTP ERROR 500')) {
      fs.writeFileSync(SUBS_ENDING_5D_DETAILS_FILE, subs5dDetailsCSV, 'utf-8');
      console.log(`✅ Cached Subscriptions Ending 5d details (${subs5dDetailsCSV.split('\n').filter(Boolean).length - 1} records) to ${SUBS_ENDING_5D_DETAILS_FILE}`);
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not cache Subscriptions Ending 5d details from Metabase:', err.message);
  }

  // Fetch and cache Subscriptions Expired / Cancelled in Last 7 Days Details (f2674048)
  try {
    console.log(`📅 Fetching Subscriptions Expired / Cancelled (Last 7 Days) Detailed List from Metabase...`);
    const subsExpiredDetailsCSV = await fetchURLWithRedirect(SUBS_EXPIRED_7D_DETAILS_URL);
    if (subsExpiredDetailsCSV && subsExpiredDetailsCSV.length > 50 && !subsExpiredDetailsCSV.includes('HTTP ERROR 500')) {
      fs.writeFileSync(SUBS_EXPIRED_7D_DETAILS_FILE, subsExpiredDetailsCSV, 'utf-8');
      console.log(`✅ Cached Subscriptions Expired 7d details (${subsExpiredDetailsCSV.split('\n').filter(Boolean).length - 1} records) to ${SUBS_EXPIRED_7D_DETAILS_FILE}`);
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not cache Subscriptions Expired 7d details from Metabase:', err.message);
  }

  // Fetch and cache Subscriptions Expiring Today Details (b7e9d453)
  try {
    console.log(`📅 Fetching Subscriptions Expiring Today Detailed List from Metabase...`);
    const subsTodayDetailsCSV = await fetchURLWithRedirect(SUBS_EXPIRING_TODAY_DETAILS_URL);
    if (subsTodayDetailsCSV && subsTodayDetailsCSV.length > 50 && !subsTodayDetailsCSV.includes('HTTP ERROR 500')) {
      fs.writeFileSync(SUBS_EXPIRING_TODAY_DETAILS_FILE, subsTodayDetailsCSV, 'utf-8');
      console.log(`✅ Cached Subscriptions Expiring Today details (${subsTodayDetailsCSV.split('\n').filter(Boolean).length - 1} records) to ${SUBS_EXPIRING_TODAY_DETAILS_FILE}`);
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not cache Subscriptions Expiring Today details from Metabase:', err.message);
  }

  // Fetch and cache Plan Expired and Not a Single Order Placed Details (debcc18f)
  try {
    console.log(`📦 Fetching Plan Expired & No Order Detailed List from Metabase...`);
    const planExpDetailsCSV = await fetchURLWithRedirect(PLAN_EXP_NO_ORDER_DETAILS_URL);
    if (planExpDetailsCSV && planExpDetailsCSV.length > 50 && !planExpDetailsCSV.includes('HTTP ERROR 500')) {
      fs.writeFileSync(PLAN_EXP_NO_ORDER_DETAILS_FILE, planExpDetailsCSV, 'utf-8');
      console.log(`✅ Cached Plan Expired No Order details (${planExpDetailsCSV.split('\n').filter(Boolean).length - 1} records) to ${PLAN_EXP_NO_ORDER_DETAILS_FILE}`);
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not cache Plan Expired No Order details from Metabase:', err.message);
  }

  // Fetch and cache Plan Expiring and Not Placed a Single Order Details (cec33372)
  try {
    console.log(`📦 Fetching Plan Expiring & No Order Detailed List from Metabase...`);
    const planExpiringDetailsCSV = await fetchURLWithRedirect(PLAN_EXPIRING_NO_ORDER_DETAILS_URL);
    if (planExpiringDetailsCSV && !planExpiringDetailsCSV.includes('HTTP ERROR 500')) {
      fs.writeFileSync(PLAN_EXPIRING_NO_ORDER_DETAILS_FILE, planExpiringDetailsCSV, 'utf-8');
      const linesCount = planExpiringDetailsCSV.split('\n').filter(Boolean).length;
      console.log(`✅ Cached Plan Expiring No Order details (${Math.max(0, linesCount - 1)} records) to ${PLAN_EXPIRING_NO_ORDER_DETAILS_FILE}`);
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not cache Plan Expiring No Order details from Metabase:', err.message);
  }

  // Fetch and cache Active Subscriber & No Orders Placed Yet Details (d94cc795)
  try {
    console.log(`📦 Fetching Active Sub & No Order Detailed List from Metabase...`);
    const actSubNoOrdDetailsCSV = await fetchURLWithRedirect(ACTIVE_SUB_NO_ORDERS_DETAILS_URL);
    if (actSubNoOrdDetailsCSV && actSubNoOrdDetailsCSV.length > 50 && !actSubNoOrdDetailsCSV.includes('HTTP ERROR 500')) {
      fs.writeFileSync(ACTIVE_SUB_NO_ORDERS_DETAILS_FILE, actSubNoOrdDetailsCSV, 'utf-8');
      const linesCount = actSubNoOrdDetailsCSV.split('\n').filter(Boolean).length;
      console.log(`✅ Cached Active Sub No Order details (${Math.max(0, linesCount - 1)} records) to ${ACTIVE_SUB_NO_ORDERS_DETAILS_FILE}`);
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not cache Active Sub No Order details from Metabase:', err.message);
  }

  // Fetch and cache Delivery Fees Detailed List (69801b76)
  try {
    console.log(`🚚 Fetching Delivery Fees Detailed List from Metabase...`);
    const delivFeesDetailsCSV = await fetchURLWithRedirect(DELIVERY_FEES_DETAILS_URL);
    if (delivFeesDetailsCSV && delivFeesDetailsCSV.length > 50 && !delivFeesDetailsCSV.includes('HTTP ERROR 500')) {
      fs.writeFileSync(DELIVERY_FEES_DETAILS_FILE, delivFeesDetailsCSV, 'utf-8');
      const linesCount = delivFeesDetailsCSV.split('\n').filter(Boolean).length;
      console.log(`✅ Cached Delivery Fees details (${Math.max(0, linesCount - 1)} records) to ${DELIVERY_FEES_DETAILS_FILE}`);
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not cache Delivery Fees details from Metabase:', err.message);
  }

  // Fetch and cache Missed Leads Details (a213917a)
  try {
    console.log(`⏰ Fetching Missed Leads (>24 hrs) Detailed List from Metabase...`);
    const missedDetailsCSV = await fetchURLWithRedirect(MISSED_LEADS_DETAILS_URL);
    if (missedDetailsCSV && missedDetailsCSV.length > 50 && !missedDetailsCSV.includes('HTTP ERROR 500')) {
      fs.writeFileSync(MISSED_LEADS_DETAILS_FILE, missedDetailsCSV, 'utf-8');
      const linesCount = missedDetailsCSV.split('\n').filter(Boolean).length;
      console.log(`✅ Cached Missed Leads details (${Math.max(0, linesCount - 1)} records) to ${MISSED_LEADS_DETAILS_FILE}`);
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not cache Missed Leads details from Metabase:', err.message);
  }

  // Fetch and cache New Subscribers in Last 7 Days Details (1fab800f)
  try {
    console.log(`⚡ Fetching New Subscribers (Last 7 Days) Detailed List from Metabase...`);
    const newSubsDetailsCSV = await fetchURLWithRedirect(NEW_SUBS_7D_DETAILS_URL);
    if (newSubsDetailsCSV && newSubsDetailsCSV.length > 50 && !newSubsDetailsCSV.includes('HTTP ERROR 500')) {
      fs.writeFileSync(NEW_SUBS_7D_DETAILS_FILE, newSubsDetailsCSV, 'utf-8');
      const linesCount = newSubsDetailsCSV.split('\n').filter(Boolean).length;
      console.log(`✅ Cached New Subscribers 7d details (${Math.max(0, linesCount - 1)} records) to ${NEW_SUBS_7D_DETAILS_FILE}`);
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not cache New Subscribers 7d details from Metabase:', err.message);
  }

  // Fetch and cache Total Active Subscriptions Detailed Records (06440078)
  try {
    console.log(`📦 Fetching Total Active Subscriptions Detailed List from Metabase...`);
    const actSubsDetailsCSV = await fetchURLWithRedirect(ACTIVE_SUBS_DETAILS_URL);
    if (actSubsDetailsCSV && actSubsDetailsCSV.length > 50 && !actSubsDetailsCSV.includes('HTTP ERROR 500')) {
      fs.writeFileSync(ACTIVE_SUBS_DETAILS_FILE, actSubsDetailsCSV, 'utf-8');
      const linesCount = actSubsDetailsCSV.split('\n').filter(Boolean).length;
      console.log(`✅ Cached Active Subscriptions details (${Math.max(0, linesCount - 1)} records) to ${ACTIVE_SUBS_DETAILS_FILE}`);
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not cache Active Subscriptions details from Metabase:', err.message);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(sortedDays, null, 2), 'utf-8');
  console.log(`✅ Successfully synced ${sortedDays.length} days of data with D-o-D User Breakdown & Refunds to ${OUTPUT_FILE}`);

  return sortedDays;
}

if (require.main === module) {
  syncSalesData().catch(err => {
    console.error('❌ Error syncing data:', err);
    process.exit(1);
  });
}

module.exports = { syncSalesData, fetchSheetCSV, fetchMetabaseCSV };
