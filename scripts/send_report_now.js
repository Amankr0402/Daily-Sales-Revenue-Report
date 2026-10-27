/**
 * Immediate & Automated Daily Sales Report Email Delivery
 * Renders EXACTLY the metrics, sections, and tables from the website dashboard.
 * Formatted cleanly with email-safe layout, attached PDF, and live dashboard links.
 */
require('dotenv').config();
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const { syncSalesData } = require('./sync_sheets');

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || `"Aman Soni" <${SMTP_USER || 'aman.soni@theelefant.ai'}>`;
const DASHBOARD_URL = 'https://daily-sales-revenue-report.vercel.app/';

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    throw new Error('❌ Missing SMTP credentials! Set SMTP_USER and SMTP_PASS environment variables.');
  }
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: user,
      pass: pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
  });
  return transporter;
}

const fmt = n => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const fmtK = n => {
  n = Math.round(n || 0);
  if (Math.abs(n) >= 100000) return (n / 100000).toFixed(1) + 'L';
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString('en-IN');
};
const sd = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
const fd = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const formatLocalISO = d => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
};
const ini = n => n.split(' ').map(x => x[0]).join('').substring(0, 2).toUpperCase();

function calcPeriodSums(days) {
  let insideRev = 0, insideCnt = 0;
  let pureInsideRev = 0, pureInsideCnt = 0;
  let eventsRev = 0, eventsCnt = 0;
  let renewalsRev = 0, renewalsCnt = 0;
  let directRev = 0, directCnt = 0;
  let overlapRev = 0, overlapCnt = 0;
  let selfUpRev = 0, selfUpCnt = 0;
  let delFeeRev = 0, delFeeCnt = 0;
  let otherRev = 0, otherCnt = 0;
  let totalRev = 0, totalCnt = 0;

  days.forEach(d => {
    let dayIns = 0, dayInsCnt = 0;
    let dayPureIns = 0, dayPureInsCnt = 0;
    let dayOther = 0, dayOtherCnt = 0;

    Object.entries(d.sources || {}).forEach(([s, info]) => {
      const rev = info.revenue || 0;
      const cnt = info.count || 0;
      if (s !== 'Direct Sale' && s !== 'Self Upgrade' && s !== 'Disputed Sales' && s !== 'Colliding Sales' && s !== 'Overlap Deals') {
        dayIns += rev;
        dayInsCnt += cnt;
      }
      if (s === 'Organic' || s === 'Upgrade' || s === 'No') {
        dayPureIns += rev;
        dayPureInsCnt += cnt;
      } else if (s === 'Events' || s === 'Renewals' || s === 'Yes' || s === 'Direct Sale' || s === 'Self Upgrade' || s === 'Disputed Sales' || s === 'Colliding Sales' || s === 'Overlap Deals') {
      } else {
        dayOther += rev;
        dayOtherCnt += cnt;
      }
    });

    const dEvents = (d.sources && d.sources['Events'] && d.sources['Events'].revenue) || 0;
    const dEventsCnt = (d.sources && d.sources['Events'] && d.sources['Events'].count) || 0;
    const dRenewals = (d.sources && d.sources['Renewals'] && d.sources['Renewals'].revenue) || (d.sources && d.sources['Yes'] && d.sources['Yes'].revenue) || 0;
    const dRenewalsCnt = (d.sources && d.sources['Renewals'] && d.sources['Renewals'].count) || (d.sources && d.sources['Yes'] && d.sources['Yes'].count) || 0;
    const dDir = (d.sources && d.sources['Direct Sale'] && d.sources['Direct Sale'].revenue) || 0;
    const dDirCnt = (d.sources && d.sources['Direct Sale'] && d.sources['Direct Sale'].count) || 0;
    const dOverlap = (d.sources && d.sources['Overlap Deals'] && d.sources['Overlap Deals'].revenue) || (d.disputedTotal && d.disputedTotal.revenue) || 0;
    const dOverlapCnt = (d.sources && d.sources['Overlap Deals'] && d.sources['Overlap Deals'].count) || (d.disputedTotal && d.disputedTotal.count) || 0;
    const dSelfUp = (d.sources && d.sources['Self Upgrade'] && d.sources['Self Upgrade'].revenue) || 0;
    const dSelfUpCnt = (d.sources && d.sources['Self Upgrade'] && d.sources['Self Upgrade'].count) || 0;
    const dDel = (d.deliveryFee && d.deliveryFee.total) || 0;
    const dDelTx = (d.deliveryFee && (d.deliveryFee.transactions || d.deliveryFee.count)) || 0;

    const dTot = (d.totalRevenue || 0) + dDel;

    insideRev += dayIns;
    insideCnt += dayInsCnt;
    pureInsideRev += dayPureIns;
    pureInsideCnt += dayPureInsCnt;
    eventsRev += dEvents;
    eventsCnt += dEventsCnt;
    renewalsRev += dRenewals;
    renewalsCnt += dRenewalsCnt;
    directRev += dDir;
    directCnt += dDirCnt;
    overlapRev += dOverlap;
    overlapCnt += dOverlapCnt;
    selfUpRev += dSelfUp;
    selfUpCnt += dSelfUpCnt;
    delFeeRev += dDel;
    delFeeCnt += dDelTx;
    otherRev += dayOther;
    otherCnt += dayOtherCnt;
    totalRev += dTot;
    totalCnt += (d.salesCount || 0);
  });

  const aov = totalCnt > 0 ? Math.round(totalRev / totalCnt) : 0;
  return {
    insideRev, insideCnt,
    pureInsideRev, pureInsideCnt,
    eventsRev, eventsCnt,
    renewalsRev, renewalsCnt,
    directRev, directCnt,
    overlapRev, overlapCnt,
    selfUpRev, selfUpCnt,
    delFeeRev, delFeeCnt,
    otherRev, otherCnt,
    totalRev, totalCnt,
    aov
  };
}

function formatDelta(cur, prev, isCurrency = true) {
  if (prev === undefined || prev === null || prev === 0) {
    if (cur > 0) return '<span style="color:#059669;font-weight:800;">▲ +100%</span>';
    return '<span style="color:#94a3b8;">—</span>';
  }
  const diff = cur - prev;
  const pct = ((diff / Math.abs(prev)) * 100).toFixed(1);
  const isPos = diff >= 0;
  const color = isPos ? '#059669' : '#dc2626';
  const arrow = isPos ? '▲ +' : '▼ ';
  const diffStr = isCurrency ? (isPos ? '+' : '') + fmtK(diff) : (isPos ? '+' : '') + diff;
  return `<span style="color:${color};font-weight:800;white-space:nowrap;">${arrow}${Math.abs(pct)}% <span style="font-size:9.5px;color:#64748b;font-weight:600;">(${diffStr})</span></span>`;
}

function formatDeltaPill(cur, prev, isCurrency = true) {
  if (prev === undefined || prev === null || prev === 0) {
    if (cur > 0) return '<span style="display:inline-block;padding:2px 5px;border-radius:10px;font-size:9px;font-weight:800;color:#059669;background:#f0fdf4;border:1px solid #bbf7d0;white-space:nowrap;">▲ +100%</span>';
    return '<span style="color:#94a3b8;font-size:9px;">—</span>';
  }
  const diff = cur - prev;
  const pct = ((diff / Math.abs(prev)) * 100).toFixed(1);
  const isPos = diff >= 0;
  const color = isPos ? '#059669' : '#dc2626';
  const bg = isPos ? '#f0fdf4' : '#fef2f2';
  const border = isPos ? '#bbf7d0' : '#fecaca';
  const arrow = isPos ? '▲ +' : '▼ ';
  const diffStr = isCurrency ? (isPos ? '+₹' : '-₹') + Math.abs(Math.round(diff)).toLocaleString('en-IN') : (isPos ? '+' : '') + diff;
  return `<span style="display:inline-block;padding:2px 5px;border-radius:10px;font-size:9px;font-weight:800;color:${color};background:${bg};border:1px solid ${border};white-space:nowrap;">${arrow}${Math.abs(pct)}% (${diffStr})</span>`;
}

function formatDeltaText(cur, prev, isCurrency = true) {
  if (prev === undefined || prev === null || prev === 0) {
    if (cur > 0) {
      const diffStr = isCurrency ? '+₹' + Math.round(cur).toLocaleString('en-IN') : '+' + cur;
      return `<span style="color:#059669;font-weight:800;white-space:nowrap;">▲ +100% (${diffStr})</span>`;
    }
    return '<span style="color:#94a3b8;">—</span>';
  }
  const diff = cur - prev;
  const pct = ((diff / Math.abs(prev)) * 100).toFixed(1);
  const isPos = diff >= 0;
  const color = isPos ? '#059669' : '#dc2626';
  const arrow = isPos ? '▲ +' : '▼ ';
  const diffStr = isCurrency ? (isPos ? '+₹' : '-₹') + Math.abs(Math.round(diff)).toLocaleString('en-IN') : (isPos ? '+' : '') + diff;
  return `<span style="color:${color};font-weight:800;white-space:nowrap;">${arrow}${Math.abs(pct)}% (${diffStr})</span>`;
}

function quickChartURL(config, width = 600, height = 240) {
  const json = JSON.stringify(config);
  return `https://quickchart.io/chart?c=${encodeURIComponent(json)}&w=${width}&h=${height}&bkg=white&f=png`;
}

function getRecipients() {
  const filePath = path.join(__dirname, '..', 'config', 'employees.json');
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { recipients } = JSON.parse(raw);
      return recipients.map(r => typeof r === 'string' ? r : `"${r.name}" <${r.email}>`).filter(Boolean);
    } catch (e) {
      console.warn('⚠️ Could not parse employees.json:', e.message);
    }
  }
  return ['"Aman Soni" <aman.soni@theelefant.ai>'];
}

async function generatePDF(htmlContent) {
  let browser;
  try {
    const logoPath = path.join(__dirname, '..', 'public', 'elefant-logo.png');
    let pdfHtml = htmlContent;
    if (fs.existsSync(logoPath)) {
      const logoBase64 = fs.readFileSync(logoPath).toString('base64');
      pdfHtml = pdfHtml.replace(/cid:elefant_logo/g, `data:image/png;base64,${logoBase64}`);
    }

    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 850, height: 1200, deviceScaleFactor: 2 });
    await page.setContent(pdfHtml, { waitUntil: 'load', timeout: 20000 });
    await new Promise(r => setTimeout(r, 1500));
    await page.emulateMediaType('screen');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' }
    });
    return pdfBuffer;
  } catch (err) {
    console.warn('⚠️ PDF generation failed:', err.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

function buildEmailHtml(allData) {
  allData.sort((a, b) => a.date.localeCompare(b.date));
  const yd = allData[allData.length - 1];

  // 1. Revenue
  const deliveryTotal = (yd.deliveryFee && yd.deliveryFee.total > 0) ? yd.deliveryFee.total : 0;
  const grandTotal = (yd.totalRevenue || 0) + deliveryTotal;
  const salesCount = yd.salesCount || 0;
  const aov = salesCount > 0 ? Math.round(grandTotal / salesCount) : 0;

  // Channels
  const SRC_C = {
    Events: '#6366f1',
    Organic: '#10b981',
    Renewals: '#f59e0b',
    Upgrade: '#06b6d4',
    'Self Subscription': '#8b5cf6',
    'Direct Sale': '#ec4899',
    'Self Upgrade': '#8b5cf6',
    'Overlap Deals': '#f59e0b'
  };
  const SRC_L = {
    Organic: '🤝 Inside Sales',
    Events: '🎤 Events',
    Renewals: '🔄 Renewals',
    Upgrade: '⬆️ Upgrades',
    'Self Subscription': '📱 Self Sub',
    'Direct Sale': '🛍️ Direct Sale',
    'Self Upgrade': '🚀 Self Upgrade',
    'Overlap Deals': '🔄 Overlap Deals'
  };

  const sourcesList = Object.entries(yd.sources || {}).sort((a, b) => b[1].revenue - a[1].revenue);

  // Overlap deals
  const disp = yd.disputedTotal || yd.collidingTotal || { count: 0, revenue: 0 };

  // Highest Sale
  const hsAmount = yd.highestSale?.amount ? fmt(yd.highestSale.amount) : '—';
  const hsIsAgent = yd.agents && yd.agents[yd.highestSale?.agent];
  const hsDisplay = (hsIsAgent || yd.highestSale?.source === 'Inside Sales')
    ? `Closed by ${yd.highestSale.agent}`
    : 'Self Serve';
  const hsAgent = yd.highestSale?.agent ? hsDisplay : '—';

  // 3. Podium Ranking (Last 1 Day / Yesterday)
  const agentsMap = {};
  Object.entries(yd.agents || {}).forEach(([name, info]) => {
    if (!agentsMap[name]) agentsMap[name] = { revenue: 0, count: 0 };
    agentsMap[name].revenue += (info.revenue || 0);
    agentsMap[name].count += (info.count || 0);
  });
  const sortedAgents = Object.entries(agentsMap).sort((a, b) => b[1].revenue - a[1].revenue);
  const top3 = sortedAgents.slice(0, 3);
  const bottom3 = sortedAgents.length >= 3 ? sortedAgents.slice(-3) : [];

  // Direct Sales Net AOV
  const directSaleInfo = (yd.sources && yd.sources['Direct Sale']) || { revenue: 0, count: 0 };
  const directSaleRev = directSaleInfo.revenue || 0;
  const directSaleCnt = directSaleInfo.count || 0;
  const directSaleAOV = directSaleCnt > 0 ? Math.round(directSaleRev / directSaleCnt) : 0;

  // 5. Period Revenue & Executive Growth (Sunday-anchored W-o-W & M-o-M)
  const ydDateObj = new Date(yd.date + 'T00:00:00');
  const dayOfWeek = ydDateObj.getDay(); // 0 = Sun, 1 = Mon ...
  const weekStartObj = new Date(ydDateObj);
  weekStartObj.setDate(ydDateObj.getDate() - dayOfWeek);
  const weekStartStr = formatLocalISO(weekStartObj);

  // W-o-W windows
  const wowCurStart = weekStartStr;
  const wowCurEnd = yd.date;
  const prevWeekStartObj = new Date(weekStartObj);
  prevWeekStartObj.setDate(weekStartObj.getDate() - 7);
  const wowPrevStart = formatLocalISO(prevWeekStartObj);
  const prevWeekEndObj = new Date(ydDateObj);
  prevWeekEndObj.setDate(ydDateObj.getDate() - 7);
  const wowPrevEnd = formatLocalISO(prevWeekEndObj);

  const wowCurDays = allData.filter(d => d.date >= wowCurStart && d.date <= wowCurEnd);
  const wowPrevDays = allData.filter(d => d.date >= wowPrevStart && d.date <= wowPrevEnd);
  const wowCur = calcPeriodSums(wowCurDays);
  const wowPrev = calcPeriodSums(wowPrevDays);

  const wowRevDiff = wowCur.totalRev - wowPrev.totalRev;
  const wowRevPct = wowPrev.totalRev > 0 ? ((wowRevDiff / wowPrev.totalRev) * 100).toFixed(1) : (wowCur.totalRev > 0 ? '100' : '0');
  const wowDealsDiff = wowCur.totalCnt - wowPrev.totalCnt;

  // M-o-M windows (MTD 1st–yd vs Prior Month 1st–Same Day)
  const curParts = yd.date.split('-');
  const curYear = parseInt(curParts[0], 10);
  const curMonth = parseInt(curParts[1], 10);
  const curDay = parseInt(curParts[2], 10);
  const momCurStart = `${curParts[0]}-${curParts[1]}-01`;
  const momCurEnd = yd.date;

  let prevMonthYear = curYear;
  let prevMonth = curMonth - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevMonthYear = curYear - 1;
  }
  const prevMonthStr = String(prevMonth).padStart(2, '0');
  const daysInPrevMonth = new Date(prevMonthYear, prevMonth, 0).getDate();
  const matchedPrevDay = Math.min(curDay, daysInPrevMonth);
  const matchedPrevDayStr = String(matchedPrevDay).padStart(2, '0');
  const momPrevStart = `${prevMonthYear}-${prevMonthStr}-01`;
  const momPrevEnd = `${prevMonthYear}-${prevMonthStr}-${matchedPrevDayStr}`;

  const momCurDays = allData.filter(d => d.date >= momCurStart && d.date <= momCurEnd);
  const momPrevDays = allData.filter(d => d.date >= momPrevStart && d.date <= momPrevEnd);
  const momCur = calcPeriodSums(momCurDays);
  const momPrev = calcPeriodSums(momPrevDays);

  const momRevDiff = momCur.totalRev - momPrev.totalRev;
  const momRevPct = momPrev.totalRev > 0 ? ((momRevDiff / momPrev.totalRev) * 100).toFixed(1) : (momCur.totalRev > 0 ? '100' : '0');
  const momDealsDiff = momCur.totalCnt - momPrev.totalCnt;

  const wowSub = `${sd(wowCurStart)}–${sd(wowCurEnd)} vs ${sd(wowPrevStart)}–${sd(wowPrevEnd)} (${wowCurDays.length} Days Like-for-Like)`;
  const momSub = `${sd(momCurStart)}–${sd(momCurEnd)} vs ${sd(momPrevStart)}–${sd(momPrevEnd)} (${momCurDays.length} Days Like-for-Like)`;

  // Category Breakdown rows
  const breakdownRows = [
    { name: '🔥 Total Revenue', wCur: fmt(wowCur.totalRev), wPrev: fmt(wowPrev.totalRev), wG: formatDeltaText(wowCur.totalRev, wowPrev.totalRev, true), mCur: fmt(momCur.totalRev), mPrev: fmt(momPrev.totalRev), mG: formatDeltaText(momCur.totalRev, momPrev.totalRev, true), isBold: true },
    { name: '🤝 Deals Closed (Sales)', wCur: wowCur.totalCnt + ' deals', wPrev: wowPrev.totalCnt + ' deals', wG: formatDeltaText(wowCur.totalCnt, wowPrev.totalCnt, false), mCur: momCur.totalCnt + ' deals', mPrev: momPrev.totalCnt + ' deals', mG: formatDeltaText(momCur.totalCnt, momPrev.totalCnt, false), isBold: true },
    { name: '🎯 Blended AOV', wCur: fmt(wowCur.aov), wPrev: fmt(wowPrev.aov), wG: formatDeltaText(wowCur.aov, wowPrev.aov, true), mCur: fmt(momCur.aov), mPrev: fmt(momPrev.aov), mG: formatDeltaText(momCur.aov, momPrev.aov, true) },
    { name: '🤝 Inside Sales Revenue', wCur: fmt(wowCur.pureInsideRev), wPrev: fmt(wowPrev.pureInsideRev), wG: formatDeltaText(wowCur.pureInsideRev, wowPrev.pureInsideRev, true), mCur: fmt(momCur.pureInsideRev), mPrev: fmt(momPrev.pureInsideRev), mG: formatDeltaText(momCur.pureInsideRev, momPrev.pureInsideRev, true) },
    { name: '🎤 Events Revenue', wCur: fmt(wowCur.eventsRev), wPrev: fmt(wowPrev.eventsRev), wG: formatDeltaText(wowCur.eventsRev, wowPrev.eventsRev, true), mCur: fmt(momCur.eventsRev), mPrev: fmt(momPrev.eventsRev), mG: formatDeltaText(momCur.eventsRev, momPrev.eventsRev, true) },
    { name: '🔄 Renewals Revenue', wCur: fmt(wowCur.renewalsRev), wPrev: fmt(wowPrev.renewalsRev), wG: formatDeltaText(wowCur.renewalsRev, wowPrev.renewalsRev, true), mCur: fmt(momCur.renewalsRev), mPrev: fmt(momPrev.renewalsRev), mG: formatDeltaText(momCur.renewalsRev, momPrev.renewalsRev, true) },
    { name: '🛍️ Direct Sales (Self Serve) Rev', wCur: fmt(wowCur.directRev), wPrev: fmt(wowPrev.directRev), wG: formatDeltaText(wowCur.directRev, wowPrev.directRev, true), mCur: fmt(momCur.directRev), mPrev: fmt(momPrev.directRev), mG: formatDeltaText(momCur.directRev, momPrev.directRev, true) },
    { name: '🔀 Overlap Deals Revenue', wCur: fmt(wowCur.overlapRev), wPrev: fmt(wowPrev.overlapRev), wG: formatDeltaText(wowCur.overlapRev, wowPrev.overlapRev, true), mCur: fmt(momCur.overlapRev), mPrev: fmt(momPrev.overlapRev), mG: formatDeltaText(momCur.overlapRev, momPrev.overlapRev, true) },
    { name: '🚚 Delivery Fee Total', wCur: fmt(wowCur.delFeeRev), wPrev: fmt(wowPrev.delFeeRev), wG: formatDeltaText(wowCur.delFeeRev, wowPrev.delFeeRev, true), mCur: fmt(momCur.delFeeRev), mPrev: fmt(momPrev.delFeeRev), mG: formatDeltaText(momCur.delFeeRev, momPrev.delFeeRev, true) }
  ];

  // 6. Serviceability (Last 4 Days Funnel Snapshot)
  const last4Funnel = allData.filter(d => d.userBreakdown && d.date <= yd.date).slice(-4).reverse();
  const missed = yd.missedLeads || { Connected: 0, Interested: 0, 'Paise Dega': 0 };

  // 7. Subscriptions & Lead Journey
  const subsRows = [
    { label: 'Total Active Subscriptions', val: (yd.activeSubs || 0).toLocaleString('en-IN'), link: 'active-subscriptions.html' },
    { label: 'New Subscribers in last 7 days', val: (yd.newSubs7d || 0).toLocaleString('en-IN'), link: 'new-subs-7d-details.html' },
    { label: 'TeleCRM Leads (yesterday)', val: (yd.teleCrmLeads || 0).toLocaleString('en-IN'), link: 'telecrm-leads-details.html' },
    { label: 'Subscriptions Ending (next 5 days)', val: (yd.subsEnding5d || 0).toLocaleString('en-IN'), link: 'subs-ending-5d-details.html' },
    { label: 'Subscriptions Expired / Cancelled (last 7 days)', val: (yd.subsExpired7d || 0).toLocaleString('en-IN'), link: 'subs-expired-7d-details.html' },
    { label: 'Subscriptions Expiring Today', val: (yd.subsExpiringToday || 0).toLocaleString('en-IN'), link: 'subs-expiring-today-details.html' },
    { label: 'Plan Expiring & No Order', val: (yd.planExpiringNoOrder || 0).toLocaleString('en-IN'), link: 'plan-expiring-no-order-details.html' },
    { label: 'Plan Expired & No Order', val: (yd.planExpNoOrder || 0).toLocaleString('en-IN'), link: 'plan-exp-no-order-details.html' },
    { label: 'Active Subscription & No Order', val: (yd.activeSubNoOrder || 0).toLocaleString('en-IN'), link: 'active-sub-no-order-details.html' },
  ];

  // Delivery Status
  const newUsersDelivery = yd.newUsersDeliveryStatus || {};
  const allNewUsersOrder = yd.allNewUsersOrderStatus || {};

  // 8. Plan Distribution
  const plans = yd.plans || {};
  const planEntries = Object.entries(plans).sort((a, b) => b[1].revenue - a[1].revenue);
  const planLabels = planEntries.map(p => p[0]);
  const planCounts = planEntries.map(p => p[1].count);
  const PC = ['#6366f1', '#10b981', '#06b6d4', '#f59e0b', '#f43f5e', '#8b5cf6', '#fb923c'];

  const planChartImg = quickChartURL({
    type: 'doughnut',
    data: {
      labels: planLabels,
      datasets: [{
        data: planCounts,
        backgroundColor: PC.slice(0, planLabels.length),
        borderWidth: 2,
        borderColor: '#ffffff',
      }],
    },
    options: {
      cutoutPercentage: 60,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 10, family: 'Inter, sans-serif' }, boxWidth: 10, padding: 8 },
        },
      },
    },
  }, 480, 240);

  // 8. Sales Trend (Last 7 Days)
  const last7Days = allData.slice(-7);

  // 9. Refunds
  const refundYd = yd.refunds ? fmt(yd.refunds.total) : '₹0';
  const refundYdCount = yd.refunds ? yd.refunds.count : 0;
  const refund7d = yd.refundsLast7Days ? fmt(yd.refundsLast7Days.total) : '₹0';
  const refund7dCount = yd.refundsLast7Days ? yd.refundsLast7Days.count : 0;

  // 10. Financials (Net Revenue)
  const refundYdTotal = yd.refunds?.total || 0;
  const netRevenue = grandTotal - refundYdTotal;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Daily Sales Report — The Elefant</title>
</head>
<body style="margin:0;padding:24px 0;background-color:#ede8fb;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e1333;">
  <div style="max-width:780px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid rgba(109,40,217,0.12);box-shadow:0 8px 30px rgba(109,40,217,0.1);">
    
    <!-- HEADER -->
    <div style="background:#ffffff;padding:24px 28px;border-bottom:1px solid rgba(109,40,217,0.12);">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td>
            <div style="display:inline-block;vertical-align:middle;margin-bottom:4px;">
              <img src="cid:elefant_logo" alt="the EleFant" style="height:36px;max-width:180px;object-fit:contain;display:block;" onerror="this.src='https://daily-sales-revenue-report.vercel.app/elefant-logo.png'" />
            </div>
            <div style="font-size:13px;color:#6b7280;margin-top:2px;font-weight:600;">
              Data as of 11:59 PM, ${fd(yd.date)}
            </div>
          </td>
          <td style="text-align:right;">
            <div style="display:inline-block;background:rgba(109,40,217,0.08);border:1px solid rgba(109,40,217,0.2);color:#6d28d9;border-radius:20px;padding:5px 14px;font-size:12px;font-weight:700;">
              📅 ${sd(yd.date)}, ${ydDateObj.getFullYear()}
            </div>
          </td>
        </tr>
      </table>

      <!-- DIRECT DASHBOARD LINK BANNER -->
      <div style="margin-top:16px;background:rgba(109,40,217,0.06);border:1px solid rgba(109,40,217,0.18);border-radius:8px;padding:12px 16px;text-align:center;">
        <div style="font-size:12px;color:#4c1d95;font-weight:600;margin-bottom:6px;">
          View full drilldown tables &amp; customer logs on the live website:
        </div>
        <a href="${DASHBOARD_URL}" target="_blank" style="display:inline-block;background:#6d28d9;color:#ffffff;font-size:12.5px;font-weight:700;padding:8px 20px;border-radius:6px;text-decoration:none;">
          🌐 Open Live Dashboard &amp; View User Details ↗
        </a>
      </div>
    </div>

    <!-- 1. REVENUE (TILL 11:59 PM YESTERDAY) -->
    <div style="padding:22px 28px 14px;">
      <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:10px;">
        💰 Revenue — Till 11:59 PM Yesterday
      </div>
      <div style="background:#ffffff;border:1px solid rgba(109,40,217,0.15);border-top:3px solid #059669;border-radius:12px;padding:18px 20px;box-shadow:0 2px 8px rgba(109,40,217,0.05);">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;">Total Revenue Generated</div>
        <div style="font-size:26px;font-weight:900;color:#059669;line-height:1.2;margin-top:2px;">${fmt(grandTotal)}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px;font-weight:500;">${salesCount} deals across all channels</div>

        <!-- Channel Pills -->
        <table style="width:100%;border-collapse:separate;border-spacing:6px 6px;margin-top:14px;margin-left:-6px;margin-right:-6px;">
          <tr>
            ${sourcesList.slice(0, 3).map(([src, d]) => {
              const c = SRC_C[src] || '#8896b3';
              const l = SRC_L[src] || src;
              return `<td style="width:33.33%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;vertical-align:top;">
                <div style="font-size:11px;color:#64748b;font-weight:700;">${l}</div>
                <div style="font-size:13.5px;font-weight:800;color:#1e1333;margin-top:2px;">${fmt(d.revenue)}</div>
                <div style="font-size:10.5px;color:#64748b;">${d.count} deal${d.count !== 1 ? 's' : ''}</div>
              </td>`;
            }).join('')}
          </tr>
          ${sourcesList.length > 3 ? `
          <tr>
            ${sourcesList.slice(3, 6).map(([src, d]) => {
              const c = SRC_C[src] || '#8896b3';
              const l = SRC_L[src] || src;
              return `<td style="width:33.33%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;vertical-align:top;">
                <div style="font-size:11px;color:#64748b;font-weight:700;">${l}</div>
                <div style="font-size:13.5px;font-weight:800;color:#1e1333;margin-top:2px;">${fmt(d.revenue)}</div>
                <div style="font-size:10.5px;color:#64748b;">${d.count} deal${d.count !== 1 ? 's' : ''}</div>
              </td>`;
            }).join('')}
          </tr>` : ''}
        </table>
      </div>
    </div>

    <!-- 2. DEALS & AVERAGES -->
    <div style="padding:0 28px 16px;">
      <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:10px;">
        🤝 Deals &amp; Averages
      </div>
      <table style="width:100%;border-collapse:separate;border-spacing:8px 8px;margin-left:-8px;margin-right:-8px;">
        <tr>
          <td style="width:33.33%;background:#ffffff;border:1px solid rgba(109,40,217,0.15);border-top:3px solid #7c3aed;border-radius:10px;padding:14px;vertical-align:top;">
            <div style="font-size:10.5px;font-weight:700;color:#6b7280;text-transform:uppercase;">Total Deals Closed</div>
            <div style="font-size:22px;font-weight:900;color:#7c3aed;line-height:1.2;margin-top:2px;">${salesCount}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">Combined Direct &amp; Inside</div>
          </td>
          <td style="width:33.33%;background:#ffffff;border:1px solid rgba(109,40,217,0.15);border-top:3px solid #0891b2;border-radius:10px;padding:14px;vertical-align:top;">
            <div style="font-size:10.5px;font-weight:700;color:#6b7280;text-transform:uppercase;">Blended AOV</div>
            <div style="font-size:20px;font-weight:900;color:#0891b2;line-height:1.2;margin-top:2px;">${fmt(aov)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">Revenue ÷ Deals</div>
          </td>
          <td style="width:33.33%;background:#ffffff;border:1px solid rgba(109,40,217,0.15);border-top:3px solid #d97706;border-radius:10px;padding:14px;vertical-align:top;">
            <div style="font-size:10.5px;font-weight:700;color:#6b7280;text-transform:uppercase;">🏆 Highest Sale</div>
            <div style="font-size:20px;font-weight:900;color:#d97706;line-height:1.2;margin-top:2px;">${hsAmount}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${hsAgent}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- 3. KEY INSIGHTS (TOP & BOTTOM AGENTS PODIUM) -->
    <div style="padding:0 28px 18px;">
      <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:10px;">
        🎯 Key Insights (Top &amp; Bottom Agents — Yesterday)
      </div>
      <table style="width:100%;border-collapse:separate;border-spacing:10px 10px;margin-left:-10px;margin-right:-10px;">
        <tr>
          <!-- Top 3 -->
          <td style="width:50%;background:#ffffff;border:1px solid rgba(109,40,217,0.15);border-radius:10px;padding:14px;vertical-align:top;">
            <div style="font-size:11px;font-weight:800;color:#d97706;text-transform:uppercase;text-align:center;margin-bottom:10px;">🏆 TOP 3 AGENTS</div>
            ${top3.length > 0 ? top3.map(([name, d], i) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:12px;">
                <span style="font-weight:700;color:#1e1333;">${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} ${name}</span>
                <span style="font-weight:800;color:#059669;">${fmt(d.revenue)} <span style="font-size:10.5px;color:#64748b;font-weight:500;">(${d.count}d)</span></span>
              </div>
            `).join('') : '<div style="font-size:11px;color:#8896b3;text-align:center;">No sales recorded</div>'}
          </td>
          <!-- Bottom 3 -->
          <td style="width:50%;background:#ffffff;border:1px solid rgba(109,40,217,0.15);border-radius:10px;padding:14px;vertical-align:top;">
            <div style="font-size:11px;font-weight:800;color:#e11d48;text-transform:uppercase;text-align:center;margin-bottom:10px;">🔻 BOTTOM 3 AGENTS</div>
            ${bottom3.length > 0 ? bottom3.map(([name, d], i) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:12px;">
                <span style="font-weight:600;color:#1e1333;">🔻 ${name}</span>
                <span style="font-weight:700;color:#64748b;">${fmt(d.revenue)} <span style="font-size:10.5px;color:#64748b;">(${d.count}d)</span></span>
              </div>
            `).join('') : '<div style="font-size:11px;color:#8896b3;text-align:center;">No sales recorded</div>'}
          </td>
        </tr>
      </table>
    </div>

    <!-- 4. PERIOD REVENUE & VELOCITY BREAKDOWN (W-O-W & M-O-M SIDE-BY-SIDE) -->
    <div style="padding:0 24px 18px;">
      
      <!-- TOP ROW: 2 SIDE-BY-SIDE KPI CARDS -->
      <table style="width:100%;border-collapse:separate;border-spacing:10px 0;margin-left:-10px;margin-right:-10px;margin-bottom:14px;">
        <tr>
          <!-- LEFT: W-O-W CARD -->
          <td style="width:50%;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:14px;vertical-align:top;box-shadow:0 1px 4px rgba(0,0,0,0.03);">
            <div style="margin-bottom:8px;">
              <span style="background:rgba(99,102,241,0.12);color:#4f46e5;font-size:10px;font-weight:800;padding:3px 8px;border-radius:12px;text-transform:uppercase;letter-spacing:0.04em;">🗓️ WEEK-OVER-WEEK (W-O-W)</span>
              <div style="font-size:10px;color:#64748b;font-weight:600;margin-top:4px;">${wowSub}</div>
            </div>
            
            <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
              <tr>
                <td style="width:50%;vertical-align:top;">
                  <div style="font-size:9.5px;font-weight:800;color:#64748b;text-transform:uppercase;">🔥 TOTAL REVENUE</div>
                  <div style="font-size:18px;font-weight:900;color:#1e1333;margin-top:2px;">${fmt(wowCur.totalRev)}</div>
                  <div style="margin-top:2px;">${formatDeltaPill(wowCur.totalRev, wowPrev.totalRev, true)}</div>
                  <div style="font-size:9.5px;color:#94a3b8;margin-top:3px;">Prior WTD: ${fmt(wowPrev.totalRev)}</div>
                </td>
                <td style="width:50%;vertical-align:top;">
                  <div style="font-size:9.5px;font-weight:800;color:#64748b;text-transform:uppercase;">🤝 DEALS CLOSED (SALES)</div>
                  <div style="font-size:18px;font-weight:900;color:#1e1333;margin-top:2px;">${wowCur.totalCnt} deals</div>
                  <div style="margin-top:2px;">${formatDeltaPill(wowCur.totalCnt, wowPrev.totalCnt, false)}</div>
                  <div style="font-size:9.5px;color:#94a3b8;margin-top:3px;">Prior WTD: ${wowPrev.totalCnt} deals</div>
                </td>
              </tr>
            </table>

            <!-- 3-tile strip -->
            <table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
              <tr>
                <td style="width:33.33%;text-align:center;padding:6px 2px;">
                  <div style="font-size:8.5px;font-weight:700;color:#64748b;text-transform:uppercase;">⚡ INSIDE SALES</div>
                  <div style="font-size:10.5px;font-weight:800;color:#1e1333;margin-top:1px;">${fmt(wowCur.insideRev)} <span style="font-size:8.5px;color:#64748b;">(${wowCur.insideCnt}d)</span></div>
                  <div style="margin-top:2px;">${formatDeltaPill(wowCur.insideRev, wowPrev.insideRev, true)}</div>
                </td>
                <td style="width:33.33%;text-align:center;padding:6px 2px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
                  <div style="font-size:8.5px;font-weight:700;color:#64748b;text-transform:uppercase;">🛍️ DIRECT / SELF SERVE</div>
                  <div style="font-size:10.5px;font-weight:800;color:#1e1333;margin-top:1px;">${fmt(wowCur.directRev)} <span style="font-size:8.5px;color:#64748b;">(${wowCur.directCnt}d)</span></div>
                  <div style="margin-top:2px;">${formatDeltaPill(wowCur.directRev, wowPrev.directRev, true)}</div>
                </td>
                <td style="width:33.33%;text-align:center;padding:6px 2px;">
                  <div style="font-size:8.5px;font-weight:700;color:#64748b;text-transform:uppercase;">🎯 BLENDED AOV</div>
                  <div style="font-size:10.5px;font-weight:800;color:#1e1333;margin-top:1px;">${fmt(wowCur.aov)}</div>
                  <div style="margin-top:2px;">${formatDeltaPill(wowCur.aov, wowPrev.aov, true)}</div>
                </td>
              </tr>
            </table>
          </td>

          <!-- RIGHT: M-O-M CARD -->
          <td style="width:50%;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:14px;vertical-align:top;box-shadow:0 1px 4px rgba(0,0,0,0.03);">
            <div style="margin-bottom:8px;">
              <span style="background:rgba(8,145,178,0.12);color:#0891b2;font-size:10px;font-weight:800;padding:3px 8px;border-radius:12px;text-transform:uppercase;letter-spacing:0.04em;">🗓️ MONTH-OVER-MONTH (M-O-M MTD)</span>
              <div style="font-size:10px;color:#64748b;font-weight:600;margin-top:4px;">${momSub}</div>
            </div>
            
            <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
              <tr>
                <td style="width:50%;vertical-align:top;">
                  <div style="font-size:9.5px;font-weight:800;color:#64748b;text-transform:uppercase;">🔥 MTD REVENUE</div>
                  <div style="font-size:18px;font-weight:900;color:#1e1333;margin-top:2px;">${fmt(momCur.totalRev)}</div>
                  <div style="margin-top:2px;">${formatDeltaPill(momCur.totalRev, momPrev.totalRev, true)}</div>
                  <div style="font-size:9.5px;color:#94a3b8;margin-top:3px;">Prior MTD: ${fmt(momPrev.totalRev)}</div>
                </td>
                <td style="width:50%;vertical-align:top;">
                  <div style="font-size:9.5px;font-weight:800;color:#64748b;text-transform:uppercase;">🤝 DEALS CLOSED (SALES)</div>
                  <div style="font-size:18px;font-weight:900;color:#1e1333;margin-top:2px;">${momCur.totalCnt} deals</div>
                  <div style="margin-top:2px;">${formatDeltaPill(momCur.totalCnt, momPrev.totalCnt, false)}</div>
                  <div style="font-size:9.5px;color:#94a3b8;margin-top:3px;">Prior MTD: ${momPrev.totalCnt} deals</div>
                </td>
              </tr>
            </table>

            <!-- 3-tile strip -->
            <table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
              <tr>
                <td style="width:33.33%;text-align:center;padding:6px 2px;">
                  <div style="font-size:8.5px;font-weight:700;color:#64748b;text-transform:uppercase;">⚡ INSIDE SALES</div>
                  <div style="font-size:10.5px;font-weight:800;color:#1e1333;margin-top:1px;">${fmt(momCur.insideRev)} <span style="font-size:8.5px;color:#64748b;">(${momCur.insideCnt}d)</span></div>
                  <div style="margin-top:2px;">${formatDeltaPill(momCur.insideRev, momPrev.insideRev, true)}</div>
                </td>
                <td style="width:33.33%;text-align:center;padding:6px 2px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
                  <div style="font-size:8.5px;font-weight:700;color:#64748b;text-transform:uppercase;">🛍️ DIRECT / SELF SERVE</div>
                  <div style="font-size:10.5px;font-weight:800;color:#1e1333;margin-top:1px;">${fmt(momCur.directRev)} <span style="font-size:8.5px;color:#64748b;">(${momCur.directCnt}d)</span></div>
                  <div style="margin-top:2px;">${formatDeltaPill(momCur.directRev, momPrev.directRev, true)}</div>
                </td>
                <td style="width:33.33%;text-align:center;padding:6px 2px;">
                  <div style="font-size:8.5px;font-weight:700;color:#64748b;text-transform:uppercase;">🎯 BLENDED AOV</div>
                  <div style="font-size:10.5px;font-weight:800;color:#1e1333;margin-top:1px;">${fmt(momCur.aov)}</div>
                  <div style="margin-top:2px;">${formatDeltaPill(momCur.aov, momPrev.aov, true)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- BOTTOM ROW: 2 SIDE-BY-SIDE CATEGORY BREAKDOWN TABLES -->
      <table style="width:100%;border-collapse:separate;border-spacing:10px 0;margin-left:-10px;margin-right:-10px;">
        <tr>
          <!-- LEFT: W-O-W CATEGORY BREAKDOWN TABLE -->
          <td style="width:50%;vertical-align:top;">
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.03);">
              <div style="padding:10px 12px;background:#faf5ff;border-bottom:1px solid #e9d5ff;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:11px;font-weight:800;color:#581c87;text-transform:uppercase;">⚡ W-o-W Category Breakdown</span>
                <span style="font-size:9.5px;color:#7c3aed;font-weight:600;">${wowCurDays.length}d LfL</span>
              </div>
              <table style="width:100%;border-collapse:collapse;font-size:10.5px;">
                <thead>
                  <tr style="background:#f8fafc;color:#64748b;text-align:left;border-bottom:1px solid #e2e8f0;">
                    <th style="padding:7px 8px;font-weight:800;font-size:9.5px;text-transform:uppercase;">METRIC / CATEGORY</th>
                    <th style="padding:7px 6px;font-weight:800;font-size:9.5px;text-align:right;text-transform:uppercase;">CUR WTD</th>
                    <th style="padding:7px 6px;font-weight:700;font-size:9.5px;text-align:right;text-transform:uppercase;">PRIOR</th>
                    <th style="padding:7px 8px;font-weight:800;font-size:9.5px;text-align:right;text-transform:uppercase;">W-O-W GROWTH</th>
                  </tr>
                </thead>
                <tbody>
                  ${breakdownRows.map(r => `
                    <tr style="border-bottom:1px solid #f1f5f9;${r.isBold ? 'background:#faf5ff;font-weight:800;' : ''}">
                      <td style="padding:6px 8px;color:#1e1333;font-weight:${r.isBold ? '800' : '600'};">${r.name}</td>
                      <td style="padding:6px 6px;text-align:right;color:#1e1333;font-weight:${r.isBold ? '800' : '700'};">${r.wCur}</td>
                      <td style="padding:6px 6px;text-align:right;color:#64748b;font-size:10px;">${r.wPrev}</td>
                      <td style="padding:6px 8px;text-align:right;font-size:10px;">${r.wG}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </td>

          <!-- RIGHT: M-O-M CATEGORY BREAKDOWN TABLE -->
          <td style="width:50%;vertical-align:top;">
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.03);">
              <div style="padding:10px 12px;background:#f0fdf4;border-bottom:1px solid #bbf7d0;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:11px;font-weight:800;color:#065f46;text-transform:uppercase;">⚡ M-o-M Category Breakdown</span>
                <span style="font-size:9.5px;color:#059669;font-weight:600;">${momCurDays.length}d LfL</span>
              </div>
              <table style="width:100%;border-collapse:collapse;font-size:10.5px;">
                <thead>
                  <tr style="background:#f8fafc;color:#64748b;text-align:left;border-bottom:1px solid #e2e8f0;">
                    <th style="padding:7px 8px;font-weight:800;font-size:9.5px;text-transform:uppercase;">METRIC / CATEGORY</th>
                    <th style="padding:7px 6px;font-weight:800;font-size:9.5px;text-align:right;text-transform:uppercase;">CUR MTD</th>
                    <th style="padding:7px 6px;font-weight:700;font-size:9.5px;text-align:right;text-transform:uppercase;">PRIOR</th>
                    <th style="padding:7px 8px;font-weight:800;font-size:9.5px;text-align:right;text-transform:uppercase;">M-O-M GROWTH</th>
                  </tr>
                </thead>
                <tbody>
                  ${breakdownRows.map(r => `
                    <tr style="border-bottom:1px solid #f1f5f9;${r.isBold ? 'background:#faf5ff;font-weight:800;' : ''}">
                      <td style="padding:6px 8px;color:#1e1333;font-weight:${r.isBold ? '800' : '600'};">${r.name}</td>
                      <td style="padding:6px 6px;text-align:right;color:#1e1333;font-weight:${r.isBold ? '800' : '700'};">${r.mCur}</td>
                      <td style="padding:6px 6px;text-align:right;color:#64748b;font-size:10px;">${r.mPrev}</td>
                      <td style="padding:6px 8px;text-align:right;font-size:10px;">${r.mG}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- 5. SERVICEABILITY (LAST 4 DAYS FUNNEL & LEADS MISSED) -->
    <div style="padding:0 28px 18px;">
      <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:10px;">
        📍 Serviceability — Daily Funnel Snapshot (Last 4 Days)
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#ffffff;">
        <thead>
          <tr style="background:#f8fafc;color:#64748b;text-align:left;border-bottom:1px solid #e2e8f0;">
            <th style="padding:7px 10px;font-weight:700;">Date</th>
            <th style="padding:7px 10px;font-weight:700;text-align:center;">Signups</th>
            <th style="padding:7px 10px;font-weight:700;text-align:center;">OTP Verified</th>
            <th style="padding:7px 10px;font-weight:700;text-align:center;">Serviceable</th>
            <th style="padding:7px 10px;font-weight:700;text-align:right;">Rate</th>
          </tr>
        </thead>
        <tbody>
          ${last4Funnel.map(d => `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:7px 10px;font-weight:600;color:#1e1333;">${sd(d.date)}</td>
              <td style="padding:7px 10px;text-align:center;color:#64748b;">${(d.userBreakdown.signups || 0).toLocaleString('en-IN')}</td>
              <td style="padding:7px 10px;text-align:center;color:#64748b;">${(d.userBreakdown.otpVerified || 0).toLocaleString('en-IN')}</td>
              <td style="padding:7px 10px;text-align:center;color:#0891b2;font-weight:700;">${(d.userBreakdown.serviceable || 0).toLocaleString('en-IN')}</td>
              <td style="padding:7px 10px;text-align:right;color:#059669;font-weight:700;">${d.userBreakdown.serviceablePct || '0%'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Missed Leads -->
      <div style="margin-top:10px;padding:10px 14px;background:#ffffff;border:1px solid rgba(109,40,217,0.15);border-radius:8px;text-align:center;font-size:12px;">
        <span style="font-weight:800;color:#1e1333;">⏰ Leads Missed (>24 hrs):</span>
        <span style="margin-left:8px;color:#64748b;">Connected: <strong>${missed.Connected || 0}</strong></span> •
        <span style="margin-left:4px;color:#64748b;">Interested: <strong>${missed.Interested || 0}</strong></span> •
        <span style="margin-left:4px;color:#059669;">Paise Dega: <strong>${missed['Paise Dega'] || 0}</strong></span>
      </div>
    </div>

    <!-- 6. SUBSCRIPTIONS & LEAD JOURNEY -->
    <div style="padding:0 28px 18px;">
      <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:10px;">
        📊 Subscriptions &amp; Lead Journey
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#ffffff;">
        <thead>
          <tr style="background:#5b3e9b;color:#ffffff;text-align:left;">
            <th style="padding:8px 12px;font-weight:800;text-transform:uppercase;">PARTICULARS</th>
            <th style="padding:8px 12px;font-weight:800;text-transform:uppercase;text-align:right;">YESTERDAY</th>
          </tr>
        </thead>
        <tbody>
          ${subsRows.map((r, i) => `
            <tr style="border-bottom:1px solid #f1f5f9;${i % 2 === 1 ? 'background:#f8fafc;' : ''}">
              <td style="padding:7px 12px;color:#1e1333;font-weight:600;">${r.label}</td>
              <td style="padding:7px 12px;text-align:right;font-weight:800;color:#5b3e9b;">${r.val}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- 7. NEW USERS DELIVERY STATUS & ORDER STATUS -->
    <div style="padding:0 28px 18px;">
      <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:10px;">
        🚚 New Users Delivery &amp; Order Status
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#ffffff;margin-bottom:12px;">
        <thead>
          <tr style="background:#5b3e9b;color:#ffffff;text-align:left;">
            <th style="padding:8px 12px;font-weight:800;">NEW USERS DELIVERY STATUS</th>
            <th style="padding:8px 12px;font-weight:800;text-align:right;">COUNT</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(newUsersDelivery).filter(([k]) => !k.includes('-')).map(([k, v], i) => `
            <tr style="border-bottom:1px solid #f1f5f9;${i % 2 === 1 ? 'background:#f8fafc;' : ''}">
              <td style="padding:6px 12px;color:#1e1333;font-weight:600;">${k}</td>
              <td style="padding:6px 12px;text-align:right;font-weight:800;color:#5b3e9b;">${v}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#ffffff;">
        <thead>
          <tr style="background:#5b3e9b;color:#ffffff;text-align:left;">
            <th style="padding:8px 12px;font-weight:800;">USER ORDER &amp; DELIVERY STATUS OF ALL NEW USERS</th>
            <th style="padding:8px 12px;font-weight:800;text-align:right;">COUNT</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(allNewUsersOrder).map(([k, v], i) => `
            <tr style="border-bottom:1px solid #f1f5f9;${i % 2 === 1 ? 'background:#f8fafc;' : ''}">
              <td style="padding:6px 12px;color:#1e1333;font-weight:600;">${k}</td>
              <td style="padding:6px 12px;text-align:right;font-weight:800;color:#5b3e9b;">${v}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- 8. PLAN DISTRIBUTION -->
    <div style="padding:0 28px 18px;">
      <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:10px;">
        🥧 Plan Distribution — Yesterday
      </div>
      <div style="background:#ffffff;border:1px solid rgba(109,40,217,0.15);border-radius:10px;padding:14px;text-align:center;margin-bottom:10px;">
        <img src="${planChartImg}" alt="Plan Distribution" style="width:100%;max-width:440px;height:auto;display:block;margin:0 auto;" />
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#ffffff;">
        <thead>
          <tr style="background:#f8fafc;color:#64748b;text-align:left;border-bottom:1px solid #e2e8f0;">
            <th style="padding:7px 10px;font-weight:700;">Plan</th>
            <th style="padding:7px 10px;font-weight:700;text-align:center;">Deals</th>
            <th style="padding:7px 10px;font-weight:700;text-align:right;">Revenue</th>
            <th style="padding:7px 10px;font-weight:700;text-align:right;">Share</th>
          </tr>
        </thead>
        <tbody>
          ${planEntries.map(([p, data]) => {
            const share = grandTotal > 0 ? ((data.revenue / grandTotal) * 100).toFixed(1) : 0;
            return `
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:7px 10px;font-weight:600;color:#1e1333;">${p}</td>
                <td style="padding:7px 10px;text-align:center;color:#64748b;">${data.count}</td>
                <td style="padding:7px 10px;text-align:right;font-weight:700;color:#059669;">${fmt(data.revenue)}</td>
                <td style="padding:7px 10px;text-align:right;color:#64748b;">${share}%</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- 9. SALES TREND TABLE (LAST 7 DAYS) -->
    <div style="padding:0 28px 18px;">
      <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:10px;">
        📈 Sales Trend — Last 7 Days
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11.5px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#ffffff;">
        <thead>
          <tr style="background:#5b3e9b;color:#ffffff;text-align:left;">
            <th style="padding:7px 8px;font-weight:800;">DATE</th>
            <th style="padding:7px 8px;font-weight:800;text-align:center;">DEALS</th>
            <th style="padding:7px 8px;font-weight:800;text-align:right;">SALES</th>
            <th style="padding:7px 8px;font-weight:800;text-align:right;">DELIVERY</th>
            <th style="padding:7px 8px;font-weight:800;text-align:right;">TOTAL</th>
            <th style="padding:7px 8px;font-weight:800;text-align:right;">AOV</th>
          </tr>
        </thead>
        <tbody>
          ${last7Days.map((d, i) => {
            const del = (d.deliveryFee && d.deliveryFee.total > 0) ? d.deliveryFee.total : 0;
            const tot = (d.totalRevenue || 0) + del;
            const avg = d.salesCount > 0 ? Math.round(tot / d.salesCount) : 0;
            return `
              <tr style="border-bottom:1px solid #f1f5f9;${i % 2 === 1 ? 'background:#f8fafc;' : ''}">
                <td style="padding:6px 8px;font-weight:600;color:#1e1333;">${sd(d.date)}</td>
                <td style="padding:6px 8px;text-align:center;color:#64748b;">${d.salesCount || 0}</td>
                <td style="padding:6px 8px;text-align:right;color:#64748b;">${fmt(d.totalRevenue)}</td>
                <td style="padding:6px 8px;text-align:right;color:#64748b;">${fmt(del)}</td>
                <td style="padding:6px 8px;text-align:right;font-weight:700;color:#059669;">${fmt(tot)}</td>
                <td style="padding:6px 8px;text-align:right;color:#0891b2;font-weight:700;">${fmt(avg)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- 10. REFUNDS & FINANCIALS -->
    <div style="padding:0 28px 24px;">
      <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:10px;">
        💸 Refunds &amp; Net Financials
      </div>
      <table style="width:100%;border-collapse:separate;border-spacing:10px 10px;margin-left:-10px;margin-right:-10px;margin-bottom:12px;">
        <tr>
          <td style="width:50%;background:#ffffff;border:1px solid rgba(109,40,217,0.15);border-radius:10px;padding:12px;vertical-align:top;">
            <div style="font-size:10.5px;font-weight:700;color:#6b7280;text-transform:uppercase;">REFUND (YESTERDAY)</div>
            <div style="font-size:20px;font-weight:800;color:#e11d48;margin-top:2px;">${refundYd}</div>
            <div style="font-size:10.5px;color:#6b7280;margin-top:2px;">${refundYdCount} processed</div>
          </td>
          <td style="width:50%;background:#ffffff;border:1px solid rgba(109,40,217,0.15);border-radius:10px;padding:12px;vertical-align:top;">
            <div style="font-size:10.5px;font-weight:700;color:#6b7280;text-transform:uppercase;">REFUND (LAST 7 DAYS)</div>
            <div style="font-size:20px;font-weight:800;color:#e11d48;margin-top:2px;">${refund7d}</div>
            <div style="font-size:10.5px;color:#6b7280;margin-top:2px;">${refund7dCount} processed</div>
          </td>
        </tr>
      </table>

      <!-- Net Revenue Block -->
      <div style="background:#ffffff;border:1px solid rgba(109,40,217,0.15);border-radius:10px;overflow:hidden;">
        <div style="padding:10px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:12.5px;font-weight:800;color:#1e1333;">
          💼 Net Revenue Summary
        </div>
        <div style="padding:8px 16px;display:flex;justify-content:space-between;font-size:12px;border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">Total Sales Revenue:</span>
          <span style="font-weight:700;color:#059669;">${fmt(grandTotal)}</span>
        </div>
        <div style="padding:8px 16px;display:flex;justify-content:space-between;font-size:12px;border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">− Refunds Processed:</span>
          <span style="font-weight:700;color:#e11d48;">${fmt(refundYdTotal)}</span>
        </div>
        <div style="padding:10px 16px;display:flex;justify-content:space-between;font-size:13px;background:rgba(5,150,105,0.06);">
          <span style="font-weight:800;color:#1e1333;">= Net Revenue:</span>
          <span style="font-weight:900;color:#059669;font-size:15px;">${fmt(netRevenue)}</span>
        </div>
      </div>
    </div>

    <!-- FOOTER WITH LIVE DASHBOARD BUTTON -->
    <div style="background:#f8fafc;padding:22px 28px;text-align:center;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;line-height:1.6;">
      <div style="margin-bottom:12px;">
        <img src="cid:elefant_logo" alt="the EleFant" style="height:26px;max-width:130px;object-fit:contain;display:inline-block;vertical-align:middle;" onerror="this.src='https://daily-sales-revenue-report.vercel.app/elefant-logo.png'" />
      </div>
      <div style="margin-bottom:10px;">
        <a href="${DASHBOARD_URL}" target="_blank" style="display:inline-block;background:#6d28d9;color:#ffffff;font-size:12.5px;font-weight:700;padding:9px 22px;border-radius:6px;text-decoration:none;">
          🌐 View Live Interactive Dashboard &amp; Full User Details ↗
        </a>
      </div>
      <div>
        <strong>The Elefant Sales Analytics System</strong> • Automated Daily Intelligence Report<br />
        📎 <em>Attached PDF copy: Daily_Sales_Report_${yd.date}.pdf</em>
      </div>
    </div>

  </div>
</body>
</html>`;
}

async function sendDailyReport() {
  console.log('🔄 MANDATORY: Fetching fresh live data from Google Sheets & Metabase before building report email...');
  let allData = null;
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(`📡 Fetching live data (attempt ${attempt}/2)...`);
      allData = await syncSalesData();
      if (allData && allData.length > 0) {
        console.log(`✅ Live data fetch verified: ${allData.length} days synced.`);
        break;
      }
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ Fetch attempt ${attempt} failed: ${err.message}`);
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  if (!allData || allData.length === 0) {
    throw new Error(`CRITICAL ERROR: Failed to fetch live data before sending report! Aborting send to prevent sending wrong or stale data. Error: ${lastError?.message || 'Empty data returned'}`);
  }

  const html = buildEmailHtml(allData);

  // Keep public email preview in sync
  try {
    const previewPath = path.join(__dirname, '..', 'public', 'email_preview.html');
    fs.writeFileSync(previewPath, html, 'utf-8');
    console.log('📄 Synchronized public/email_preview.html with live report.');
  } catch (pvErr) {
    console.warn('⚠️ Could not update email_preview.html:', pvErr.message);
  }

  console.log('📄 Generating PDF attachment for daily report email...');
  const pdfBuffer = await generatePDF(html);
  const recipients = getRecipients();
  const today = allData[allData.length - 1];
  const shortDateStr = new Date(today.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const deliveryTotal = (today.deliveryFee && today.deliveryFee.total > 0) ? today.deliveryFee.total : 0;
  const grandTotal = (today.totalRevenue || 0) + deliveryTotal;

  const logoPath = path.join(__dirname, '..', 'public', 'elefant-logo.png');
  const attachments = [];
  if (fs.existsSync(logoPath)) {
    attachments.push({
      filename: 'elefant-logo.png',
      path: logoPath,
      cid: 'elefant_logo'
    });
  }

  if (pdfBuffer) {
    attachments.push({
      filename: `Daily_Sales_Report_${today.date}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    });
    console.log(`✅ PDF successfully generated and attached (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);
  }

  console.log(`📤 Sending report email for ${today.date} (${shortDateStr}) [Grand Total: ${fmt(grandTotal)}] to: ${recipients.join(', ')}`);

  const emailTransporter = getTransporter();
  const info = await emailTransporter.sendMail({
    from: SMTP_FROM,
    to: recipients.join(', '),
    subject: `📈 Daily Sales & Revenue Report — ${shortDateStr} [${fmt(grandTotal)}]`,
    html: html,
    attachments: attachments
  });

  console.log(`✅ Email Successfully Sent! Message ID: ${info.messageId}`);
  return info;
}

if (require.main === module) {
  sendDailyReport().then(() => process.exit(0)).catch(err => {
    console.error('❌ Failed to send email:', err);
    process.exit(1);
  });
}

module.exports = { sendDailyReport, buildEmailHtml };
