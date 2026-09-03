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
const REFUNDS_SPREADSHEET_ID = '1Q_IX-4CJK8_xr_7qicmhRQMOjIlLxHe0MBCS9bT-xnE';
const REFUNDS_SHEET_NAME = 'Refunds';
const METABASE_URL = 'https://metabase-bkp.theelefant.ai/public/question/a7ec6872-1841-408d-8f63-7d16e959b67c.csv';
const DELIVERY_FEE_CSV = path.join(__dirname, '..', 'data', 'delivery_fees.csv');
const DELIVERY_FEE_METABASE_URL = 'https://metabase-bkp.theelefant.ai/public/question/93b699f2-7f1c-47a8-bf39-f3261a9e92da.csv';
const DIRECT_SALE_URL = 'https://metabase-bkp.theelefant.ai/public/question/37fddfd6-fc66-4c2b-91f6-70e47192334d.csv';
const MISSED_LEADS_URL = 'https://metabase-bkp.theelefant.ai/public/question/a2dc3828-0492-4009-85d1-ce6647dda724.csv';
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
      // Handle August mixed formatting in source sheet (8/D/YYYY vs DD/08/YYYY)
      if (p1 === 8) {
        m = 8;
        d = p2;
      } else if (p2 === 8) {
        m = 8;
        d = p1;
      } else if (p1 > 12) {
        // DD/MM/YYYY
        d = p1;
        m = p2;
      } else {
        // MM/DD/YYYY
        m = p1;
        d = p2;
      }
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return clean;
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

    if (!sheetPhonesByDate[isoDate]) sheetPhonesByDate[isoDate] = new Set();
    if (phone && phone.length >= 10) sheetPhonesByDate[isoDate].add(phone);

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

      if (!sheetPhonesByDate[isoDate]) sheetPhonesByDate[isoDate] = new Set();
      if (phone && phone.length >= 10) sheetPhonesByDate[isoDate].add(phone);

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
      const phone = (cols[2] || '').replace(/\D/g, '').slice(-10);

      // Deduplicate: If this customer's deal was already logged by an agent in Google Sheets on this date, skip to avoid double counting!
      if (phone && sheetPhonesByDate[isoDate] && sheetPhonesByDate[isoDate].has(phone)) {
        continue;
      }

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
        charge:       parseFloat(dCols[2]) || 0,
        tax:          parseFloat(dCols[3]) || 0,
        total:        parseFloat(dCols[4]) || 0
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
