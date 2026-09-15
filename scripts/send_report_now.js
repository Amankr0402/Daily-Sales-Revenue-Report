/**
 * Immediate & Automated Daily Sales Report Email Delivery
 * Generates an executive, email-safe HTML report matching website design
 * Attaches a high-res PDF and direct links to https://daily-sales-revenue-report.vercel.app/
 */
require('dotenv').config();
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const { syncSalesData } = require('./sync_sheets');

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || `"Aman Soni" <${SMTP_USER}>`;
const DASHBOARD_URL = 'https://daily-sales-revenue-report.vercel.app/';

if (!SMTP_USER || !SMTP_PASS) {
  console.error('❌ Missing SMTP credentials! Set SMTP_USER and SMTP_PASS environment variables.');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 20000,
  greetingTimeout: 20000,
});

function fmtINR(num) {
  return '₹' + Math.round(num || 0).toLocaleString('en-IN');
}

function formatShortDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function quickChartURL(config, width = 600, height = 260) {
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
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 1100, deviceScaleFactor: 2 });
    await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.emulateMediaType('screen');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });
    return pdfBuffer;
  } catch (err) {
    console.warn('⚠️ PDF generation failed:', err.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

async function sendDailyReport() {
  console.log('🔄 Syncing live data from Google Sheets & Metabase before sending report...');
  let allData;
  try {
    allData = await syncSalesData();
  } catch (err) {
    console.warn('⚠️ Could not sync live data, using local data.json:', err.message);
    const dataPath = path.join(__dirname, '..', 'data', 'data.json');
    allData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  }
  allData.sort((a, b) => a.date.localeCompare(b.date));

  const today = allData[allData.length - 1];
  const yesterday = allData.length > 1 ? allData[allData.length - 2] : today;

  const d = new Date(today.date + 'T00:00:00');
  const dateStr = d.toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const shortDateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  // Revenue & Deals
  const deliveryRev = (today.deliveryFee && today.deliveryFee.total > 0) ? today.deliveryFee.total : 0;
  const deliveryCount = (today.deliveryFee && today.deliveryFee.count > 0) ? today.deliveryFee.count : 0;
  
  const todayRev     = (today.totalRevenue || 0) + deliveryRev;
  const prevDelivery = (yesterday.deliveryFee && yesterday.deliveryFee.total > 0) ? yesterday.deliveryFee.total : 0;
  const yesterdayRev = (yesterday.totalRevenue || 0) + prevDelivery;
  
  const diffRev      = todayRev - yesterdayRev;
  const diffRevStr   = (diffRev >= 0 ? '+' : '') + fmtINR(diffRev);
  const diffColor    = diffRev >= 0 ? '#059669' : '#e11d48';

  const todayCount     = today.salesCount || 0;
  const yesterdayCount = yesterday.salesCount || 0;
  const diffCount      = todayCount - yesterdayCount;
  const diffCountStr   = (diffCount >= 0 ? '+' : '') + diffCount;
  const diffCountColor = diffCount >= 0 ? '#059669' : '#e11d48';

  const todayAOV     = todayCount > 0 ? Math.round(todayRev / todayCount) : 0;
  const yesterdayAOV = yesterdayCount > 0 ? Math.round(yesterdayRev / yesterdayCount) : 0;
  const diffAOV      = todayAOV - yesterdayAOV;
  const diffAOVStr   = (diffAOV >= 0 ? '+' : '') + fmtINR(diffAOV);
  const diffAOVColor = diffAOV >= 0 ? '#059669' : '#e11d48';

  // Specific Sources
  const organicCount = today.sources?.Organic?.count || 0;
  const organicRev   = today.sources?.Organic?.revenue || 0;

  const renewalCount = (today.sources?.Renewals?.count || 0) + (today.sources?.Upgrade?.count || 0);
  const renewalRev   = (today.sources?.Renewals?.revenue || 0) + (today.sources?.Upgrade?.revenue || 0);

  const directCount  = today.sources?.['Direct Sale']?.count || 0;
  const directRev    = today.sources?.['Direct Sale']?.revenue || 0;

  const selfUpgradeCount = today.selfUpgrade?.totalCount || today.sources?.['Self Upgrade']?.count || 0;
  const selfUpgradeRev   = today.selfUpgrade?.totalRevenue || today.sources?.['Self Upgrade']?.revenue || 0;

  const overlapCount = today.disputedTotal?.count || today.collidingTotal?.count || 0;
  const overlapRev   = today.disputedTotal?.revenue || today.collidingTotal?.revenue || 0;

  const refundsCount = today.refunds?.count || 0;
  const refundsRev   = today.refunds?.total || 0;

  // Monthly Sorted Agents (MTD)
  const mStr = today.date.slice(0, 7) + '-01';
  const mData = allData.filter(d => d.date >= mStr && d.date <= today.date);
  const monthAgentsMap = {};
  mData.forEach(d => {
    Object.entries(d.agents || {}).forEach(([name, info]) => {
      if (!monthAgentsMap[name]) monthAgentsMap[name] = { revenue: 0, count: 0 };
      monthAgentsMap[name].revenue += (info.revenue || 0);
      monthAgentsMap[name].count += (info.count || 0);
    });
  });
  const sortedAgents = Object.entries(monthAgentsMap).sort((a, b) => b[1].revenue - a[1].revenue);
  const monthRev = mData.reduce((s, d) => s + (d.totalRevenue || 0), 0);
  const topAgent = sortedAgents.length > 0 ? sortedAgents[0] : ['—', { revenue: 0, count: 0 }];
  const topAgentInitials = topAgent[0].split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const topAgentPct = monthRev > 0 ? ((topAgent[1].revenue / monthRev) * 100).toFixed(1) : 0;

  // Chart 1: Revenue Trend (Last 14 days)
  const last14 = allData.slice(-14);
  const trendChartImg = quickChartURL({
    type: 'line',
    data: {
      labels: last14.map(entry => formatShortDate(entry.date)),
      datasets: [{
        label: 'Daily Revenue (INR)',
        data: last14.map(entry => (entry.totalRevenue || 0) + (entry.deliveryFee?.total || 0)),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.15)',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { font: { size: 10, family: 'Inter, sans-serif' } }, grid: { color: '#f1f5f9' } },
        y: { ticks: { font: { size: 10, family: 'Inter, sans-serif' } }, grid: { color: '#f1f5f9' } },
      },
    },
  }, 600, 240);

  // Chart 2: Plan Mix
  const plans = today.plans || {};
  const planLabels = Object.keys(plans);
  const planCounts = planLabels.map(p => plans[p].count);
  const totalPlanCount = planCounts.reduce((a, b) => a + b, 0);
  const totalPlanRev = planLabels.reduce((sum, l) => sum + (plans[l]?.revenue || 0), 0);
  const planColors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#fb7185', '#8b5cf6', '#a855f7'];
  const planChartImg = quickChartURL({
    type: 'doughnut',
    data: {
      labels: planLabels,
      datasets: [{
        data: planCounts,
        backgroundColor: planColors.slice(0, planLabels.length),
        borderWidth: 2,
        borderColor: '#ffffff',
      }],
    },
    options: {
      cutoutPercentage: 60,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 11, family: 'Inter, sans-serif' }, boxWidth: 12, padding: 10 },
        },
      },
    },
  }, 500, 250);

  // Chart 3: Channel Breakdown
  const sources = today.sources || {};
  const sourceLabels = Object.keys(sources);
  const sourceRevs = sourceLabels.map(s => sources[s].revenue);
  const sourceCounts = sourceLabels.map(s => sources[s].count);
  const sourceColors = ['#10b981', '#6366f1', '#06b6d4', '#8b5cf6', '#f59e0b', '#fb7185'];
  const channelChartImg = quickChartURL({
    type: 'bar',
    data: {
      labels: sourceLabels,
      datasets: [{
        label: 'Revenue (INR)',
        data: sourceRevs,
        backgroundColor: sourceColors.slice(0, sourceLabels.length),
        borderRadius: 6,
      }],
    },
    options: {
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: { ticks: { font: { size: 10, family: 'Inter, sans-serif' } }, grid: { display: false } },
        y: { ticks: { font: { size: 10, family: 'Inter, sans-serif' } }, grid: { color: '#f1f5f9' }, grace: '15%' },
      },
    },
  }, 600, 240);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Sales Report</title>
</head>
<body style="margin:0;padding:24px 0;background-color:#0b0f19;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 12px 40px rgba(0,0,0,0.25);">
    
    <!-- HEADER -->
    <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4338ca 100%);padding:32px 30px;color:#ffffff;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td>
            <div style="display:inline-block;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:20px;padding:4px 12px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:8px;">
              📊 The Elefant Daily Sales
            </div>
            <h1 style="margin:0;font-size:24px;font-weight:900;letter-spacing:-0.03em;color:#ffffff;line-height:1.2;">
              Daily Sales &amp; Revenue Report
            </h1>
            <p style="margin:6px 0 0;color:#cbd5e1;font-size:13.5px;font-weight:500;">
              📅 ${dateStr} • Data as of 11:59 PM
            </p>
          </td>
        </tr>
      </table>

      <!-- PROMINENT DASHBOARD LINK CTA -->
      <div style="margin-top:20px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:14px 16px;text-align:center;">
        <div style="font-size:12px;color:#e2e8f0;margin-bottom:8px;font-weight:500;">
          Want to see full customer names, phone numbers, and detailed audit lists?
        </div>
        <a href="${DASHBOARD_URL}" target="_blank" style="display:inline-block;background:#ffffff;color:#312e81;font-size:13px;font-weight:800;padding:10px 22px;border-radius:8px;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,0.15);letter-spacing:-0.01em;">
          🌐 Open Live Interactive Dashboard &amp; User Details ↗
        </a>
      </div>
    </div>

    <!-- 1. KEY METRIC SUMMARY CARDS -->
    <div style="padding:26px 28px 12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <h2 style="margin:0;font-size:15px;color:#0f172a;font-weight:800;letter-spacing:-0.01em;text-transform:uppercase;">
          📊 Key Performance Indicators (Yesterday)
        </h2>
      </div>

      <table style="width:100%;border-collapse:separate;border-spacing:10px 10px;margin-left:-10px;margin-right:-10px;">
        <tr>
          <!-- Total Revenue -->
          <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #10b981;border-radius:8px;padding:14px 16px;vertical-align:top;">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">💰 Total Revenue (All Channels)</div>
            <div style="font-size:22px;font-weight:900;color:#059669;line-height:1.2;">${fmtINR(todayRev)}</div>
            <div style="font-size:11.5px;color:${diffColor};font-weight:700;margin-top:5px;">${diffRevStr} vs previous day</div>
          </td>
          <!-- Deals Closed -->
          <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #6366f1;border-radius:8px;padding:14px 16px;vertical-align:top;">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">🤝 Deals Closed</div>
            <div style="font-size:22px;font-weight:900;color:#1e293b;line-height:1.2;">${todayCount} <span style="font-size:13px;color:#64748b;font-weight:600;">deals</span></div>
            <div style="font-size:11.5px;color:${diffCountColor};font-weight:700;margin-top:5px;">${diffCountStr} deals vs previous day</div>
          </td>
        </tr>
        <tr>
          <!-- Average Deal Size -->
          <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #06b6d4;border-radius:8px;padding:14px 16px;vertical-align:top;">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">📊 Average Deal Size (AOV)</div>
            <div style="font-size:20px;font-weight:800;color:#1e293b;line-height:1.2;">${fmtINR(todayAOV)}</div>
            <div style="font-size:11.5px;color:${diffAOVColor};font-weight:700;margin-top:5px;">${diffAOVStr} vs previous day</div>
          </td>
          <!-- Self Upgrade -->
          <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #8b5cf6;border-radius:8px;padding:14px 16px;vertical-align:top;">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">
              🚀 Self Upgrade <a href="${DASHBOARD_URL}self-upgrade-details.html" target="_blank" style="color:#8b5cf6;text-decoration:none;font-size:11px;font-weight:800;">[Details ↗]</a>
            </div>
            <div style="font-size:20px;font-weight:800;color:#8b5cf6;line-height:1.2;">${fmtINR(selfUpgradeRev)}</div>
            <div style="font-size:11.5px;color:#64748b;font-weight:600;margin-top:5px;">${selfUpgradeCount} pure upgrade deal${selfUpgradeCount !== 1 ? 's' : ''}</div>
          </td>
        </tr>
        <tr>
          <!-- Direct Sales -->
          <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #0284c7;border-radius:8px;padding:14px 16px;vertical-align:top;">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">
              🛍️ Direct Sales <a href="${DASHBOARD_URL}direct-sales-details.html" target="_blank" style="color:#0284c7;text-decoration:none;font-size:11px;font-weight:800;">[Details ↗]</a>
            </div>
            <div style="font-size:20px;font-weight:800;color:#1e293b;line-height:1.2;">${fmtINR(directRev)}</div>
            <div style="font-size:11.5px;color:#059669;font-weight:700;margin-top:5px;">${directCount} deal${directCount !== 1 ? 's' : ''} online</div>
          </td>
          <!-- Overlap Deals -->
          <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 16px;vertical-align:top;">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">
              🔄 Overlap Deals <a href="${DASHBOARD_URL}disputed-sales-details.html" target="_blank" style="color:#f59e0b;text-decoration:none;font-size:11px;font-weight:800;">[Details ↗]</a>
            </div>
            <div style="font-size:20px;font-weight:800;color:#1e293b;line-height:1.2;">${fmtINR(overlapRev)}</div>
            <div style="font-size:11.5px;color:#b45309;font-weight:700;margin-top:5px;">${overlapCount} overlap deal${overlapCount !== 1 ? 's' : ''}</div>
          </td>
        </tr>
        <tr>
          <!-- Organic Inside Sales -->
          <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #10b981;border-radius:8px;padding:14px 16px;vertical-align:top;">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">🌱 Organic Inside Sales</div>
            <div style="font-size:20px;font-weight:800;color:#1e293b;line-height:1.2;">${fmtINR(organicRev)}</div>
            <div style="font-size:11.5px;color:#059669;font-weight:700;margin-top:5px;">${organicCount} deal${organicCount !== 1 ? 's' : ''}</div>
          </td>
          <!-- Renewals & Upgrades -->
          <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #ec4899;border-radius:8px;padding:14px 16px;vertical-align:top;">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">🔄 Renewals &amp; Upgrades</div>
            <div style="font-size:20px;font-weight:800;color:#1e293b;line-height:1.2;">${fmtINR(renewalRev)}</div>
            <div style="font-size:11.5px;color:#059669;font-weight:700;margin-top:5px;">${renewalCount} deal${renewalCount !== 1 ? 's' : ''}</div>
          </td>
        </tr>
        <tr>
          <!-- Delivery Fees -->
          <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #14b8a6;border-radius:8px;padding:14px 16px;vertical-align:top;">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">
              🚚 Delivery Fee <a href="${DASHBOARD_URL}delivery-fee-details.html" target="_blank" style="color:#14b8a6;text-decoration:none;font-size:11px;font-weight:800;">[Details ↗]</a>
            </div>
            <div style="font-size:20px;font-weight:800;color:#1e293b;line-height:1.2;">${fmtINR(deliveryRev)}</div>
            <div style="font-size:11.5px;color:#64748b;font-weight:600;margin-top:5px;">${deliveryCount} transaction${deliveryCount !== 1 ? 's' : ''}</div>
          </td>
          <!-- Refunds -->
          <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #f43f5e;border-radius:8px;padding:14px 16px;vertical-align:top;">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">
              💸 Refunds (Yesterday) <a href="${DASHBOARD_URL}refunds-details.html" target="_blank" style="color:#f43f5e;text-decoration:none;font-size:11px;font-weight:800;">[Details ↗]</a>
            </div>
            <div style="font-size:20px;font-weight:800;color:#e11d48;line-height:1.2;">${fmtINR(refundsRev)}</div>
            <div style="font-size:11.5px;color:#64748b;font-weight:600;margin-top:5px;">${refundsCount} refund processed</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- 2. OPERATIONS & SUBSCRIBER STATUS SUMMARY -->
    <div style="padding:0 28px 20px;">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
        <h3 style="margin:0 0 12px;font-size:13.5px;color:#0f172a;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;">
          📦 Operations &amp; Growth Overview
        </h3>
        <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
          <tr>
            <td style="padding:6px 0;color:#64748b;font-weight:600;">Total Active Subscriptions:</td>
            <td style="padding:6px 0;text-align:right;font-weight:800;color:#1e293b;">
              ${(today.activeSubs || 0).toLocaleString('en-IN')}
              <a href="${DASHBOARD_URL}active-subscriptions.html" target="_blank" style="color:#6366f1;text-decoration:none;font-size:11px;margin-left:4px;">[List ↗]</a>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-weight:600;">New Subscribers (Last 7 Days):</td>
            <td style="padding:6px 0;text-align:right;font-weight:800;color:#059669;">
              ${(today.newSubs7d || 0).toLocaleString('en-IN')}
              <a href="${DASHBOARD_URL}new-subs-7d-details.html" target="_blank" style="color:#6366f1;text-decoration:none;font-size:11px;margin-left:4px;">[List ↗]</a>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-weight:600;">App Downloads / New Users (Yesterday):</td>
            <td style="padding:6px 0;text-align:right;font-weight:800;color:#0284c7;">
              ${(today.newUsersYesterday || 0).toLocaleString('en-IN')}
              <a href="${DASHBOARD_URL}app-downloads-details.html" target="_blank" style="color:#6366f1;text-decoration:none;font-size:11px;margin-left:4px;">[List ↗]</a>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-weight:600;">TeleCRM Leads (Yesterday):</td>
            <td style="padding:6px 0;text-align:right;font-weight:800;color:#1e293b;">
              ${(today.teleCrmLeads || 0).toLocaleString('en-IN')}
              <a href="${DASHBOARD_URL}telecrm-leads-details.html" target="_blank" style="color:#6366f1;text-decoration:none;font-size:11px;margin-left:4px;">[List ↗]</a>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-weight:600;">Subscriptions Expiring Today:</td>
            <td style="padding:6px 0;text-align:right;font-weight:800;color:#d97706;">
              ${today.subsExpiringToday || 0}
              <a href="${DASHBOARD_URL}subs-expiring-today-details.html" target="_blank" style="color:#6366f1;text-decoration:none;font-size:11px;margin-left:4px;">[List ↗]</a>
            </td>
          </tr>
        </table>
      </div>
    </div>

    <!-- 3. D-o-D USER BREAKDOWN -->
    ${today.userBreakdown ? `
    <div style="padding:0 28px 24px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <h2 style="margin:0;font-size:15px;color:#0f172a;font-weight:800;letter-spacing:-0.01em;">
          👥 D-o-D User Breakdown (Funnel)
        </h2>
        <span style="font-size:11px;background:#e0e7ff;color:#4338ca;padding:3px 10px;border-radius:12px;font-weight:700;">Conversion Funnel</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f1f5f9;color:#475569;text-align:left;">
            <th style="padding:8px 12px;font-weight:700;">Stage</th>
            <th style="padding:8px 12px;text-align:center;font-weight:700;">Count / %</th>
            <th style="padding:8px 12px;text-align:right;font-weight:700;">Description</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 12px;font-weight:700;color:#1e293b;">📝 Signups</td>
            <td style="padding:8px 12px;text-align:center;font-weight:800;color:#4338ca;">${today.userBreakdown.signups.toLocaleString('en-IN')}</td>
            <td style="padding:8px 12px;text-align:right;color:#64748b;">Total Registrations</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 12px;font-weight:700;color:#1e293b;">📍 Serviceable</td>
            <td style="padding:8px 12px;text-align:center;font-weight:800;color:#0284c7;">${today.userBreakdown.serviceable.toLocaleString('en-IN')} (${today.userBreakdown.serviceablePct})</td>
            <td style="padding:8px 12px;text-align:right;color:#64748b;">% of Signups</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 12px;font-weight:700;color:#1e293b;">🧸 Toy Viewed</td>
            <td style="padding:8px 12px;text-align:center;font-weight:800;color:#059669;">${today.userBreakdown.toyViewed}</td>
            <td style="padding:8px 12px;text-align:right;color:#64748b;">Browsed Toys</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 12px;font-weight:700;color:#1e293b;">📋 Plan Page</td>
            <td style="padding:8px 12px;text-align:center;font-weight:800;color:#2563eb;">${today.userBreakdown.planPage}</td>
            <td style="padding:8px 12px;text-align:right;color:#64748b;">Viewed Pricing</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 12px;font-weight:700;color:#1e293b;">🛒 Checkout Drop</td>
            <td style="padding:8px 12px;text-align:center;font-weight:800;color:#d97706;">${today.userBreakdown.checkoutDrop}</td>
            <td style="padding:8px 12px;text-align:right;color:#64748b;">Initiated Checkout</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 12px;font-weight:700;color:#1e293b;">💳 Payment Dropout</td>
            <td style="padding:8px 12px;text-align:center;font-weight:800;color:#e11d48;">${today.userBreakdown.paymentDropout}</td>
            <td style="padding:8px 12px;text-align:right;color:#64748b;">Dropped at Payment</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-weight:700;color:#059669;background:#f0fdf4;">🏆 Won</td>
            <td style="padding:8px 12px;text-align:center;font-weight:900;color:#059669;background:#f0fdf4;">${today.userBreakdown.won}</td>
            <td style="padding:8px 12px;text-align:right;color:#059669;font-weight:700;background:#f0fdf4;">Subscribed Successfully</td>
          </tr>
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- 4. CHARTS SECTION -->
    <div style="padding:0 28px 24px;">
      <h2 style="margin:0 0 12px;font-size:15px;color:#0f172a;font-weight:800;">
        📈 Daily Revenue Trend (Last 14 Days)
      </h2>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center;">
        <img src="${trendChartImg}" alt="Revenue Trend" style="width:100%;max-width:600px;height:auto;display:block;margin:0 auto;border-radius:6px;" />
      </div>
    </div>

    <!-- 5. PLAN MIX & CHANNELS -->
    <div style="padding:0 28px 24px;">
      <h2 style="margin:0 0 12px;font-size:15px;color:#0f172a;font-weight:800;">
        🥧 Plan Mix Distribution
      </h2>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:12px;text-align:center;">
        <img src="${planChartImg}" alt="Plan Mix" style="width:100%;max-width:480px;height:auto;display:block;margin:0 auto;border-radius:6px;" />
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f1f5f9;color:#475569;text-align:left;">
            <th style="padding:8px 12px;font-weight:700;">Plan</th>
            <th style="padding:8px 12px;text-align:center;font-weight:700;">Deals</th>
            <th style="padding:8px 12px;text-align:right;font-weight:700;">Revenue</th>
            <th style="padding:8px 12px;text-align:right;font-weight:700;">Share</th>
          </tr>
        </thead>
        <tbody>
          ${planLabels.map(p => {
            const pData = plans[p] || { count: 0, revenue: 0 };
            const pShare = todayRev > 0 ? ((pData.revenue / todayRev) * 100).toFixed(1) : 0;
            return `
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px 12px;font-weight:600;color:#1e293b;">${p}</td>
                <td style="padding:8px 12px;text-align:center;color:#64748b;">${pData.count}</td>
                <td style="padding:8px 12px;text-align:right;font-weight:700;color:#059669;">${fmtINR(pData.revenue)}</td>
                <td style="padding:8px 12px;text-align:right;color:#64748b;">${pShare}%</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- 6. TOP PERFORMING AGENTS -->
    <div style="padding:0 28px 28px;">
      <h2 style="margin:0 0 14px;font-size:15px;color:#0f172a;font-weight:800;">
        🏆 Top Performing Sales Agents (Month to Date)
      </h2>
      
      ${sortedAgents.length > 0 ? `
      <div style="background:linear-gradient(135deg,#fef9c3 0%,#fef08a 50%,#fde047 100%);border:2px solid #f59e0b;border-radius:12px;padding:16px 20px;margin-bottom:14px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="vertical-align:middle;">
              <div style="display:inline-block;background:#b45309;color:#ffffff;font-size:10px;font-weight:800;padding:2px 8px;border-radius:12px;text-transform:uppercase;margin-bottom:4px;">
                👑 TOP PERFORMER
              </div>
              <h3 style="margin:2px 0 0;font-size:18px;font-weight:900;color:#78350f;">${topAgent[0]}</h3>
              <div style="font-size:11.5px;color:#92400e;font-weight:600;margin-top:2px;">
                🎯 ${topAgent[1].count} deals • 📈 ${topAgentPct}% of MTD revenue
              </div>
            </td>
            <td style="text-align:right;vertical-align:middle;">
              <div style="font-size:10px;color:#92400e;font-weight:700;text-transform:uppercase;">Revenue Closed</div>
              <div style="font-size:22px;font-weight:900;color:#065f46;line-height:1.2;">${fmtINR(topAgent[1].revenue)}</div>
            </td>
          </tr>
        </table>
      </div>
      ` : ''}

      <table style="width:100%;border-collapse:collapse;font-size:12.5px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0;text-align:left;color:#475569;">
            <th style="padding:8px 12px;font-weight:700;width:70px;">Rank</th>
            <th style="padding:8px 12px;font-weight:700;">Agent Name</th>
            <th style="padding:8px 12px;text-align:center;font-weight:700;">Deals</th>
            <th style="padding:8px 12px;text-align:right;font-weight:700;">Revenue</th>
          </tr>
        </thead>
        <tbody>
          ${sortedAgents.slice(0, 10).map(([agent, val], idx) => {
            const rank = idx + 1;
            const badgeBg = rank === 1 ? '#fef3c7' : rank === 2 ? '#e2e8f0' : rank === 3 ? '#ffedd5' : '#f1f5f9';
            const badgeColor = rank === 1 ? '#b45309' : rank === 2 ? '#475569' : rank === 3 ? '#c2410c' : '#64748b';
            return `
              <tr style="border-bottom:1px solid #f1f5f9;${rank === 1 ? 'background:#fffbeb;' : ''}">
                <td style="padding:8px 12px;">
                  <span style="display:inline-block;background:${badgeBg};color:${badgeColor};font-weight:800;font-size:11px;padding:2px 8px;border-radius:10px;">
                    ${rank === 1 ? '🏆 #1' : '#' + rank}
                  </span>
                </td>
                <td style="padding:8px 12px;font-weight:600;color:#1e293b;">${agent}</td>
                <td style="padding:8px 12px;text-align:center;color:#64748b;">${val.count}</td>
                <td style="padding:8px 12px;text-align:right;font-weight:700;color:#059669;">${fmtINR(val.revenue)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- FOOTER WITH LIVE LINK -->
    <div style="background:#f8fafc;padding:24px 28px;text-align:center;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;line-height:1.6;">
      <div style="margin-bottom:12px;">
        <a href="${DASHBOARD_URL}" target="_blank" style="display:inline-block;background:#4338ca;color:#ffffff;font-size:13px;font-weight:700;padding:10px 24px;border-radius:8px;text-decoration:none;">
          🌐 View Live Interactive Dashboard &amp; Full User Details ↗
        </a>
      </div>
      <div>
        <strong>The Elefant Sales Analytics System</strong> • Automated Daily Intelligence Report<br />
        📎 <em>A clean PDF copy of this report has also been attached to this email.</em>
      </div>
    </div>

  </div>
</body>
</html>`;

  const recipients = getRecipients();
  console.log(`📄 Generating high quality PDF attachment...`);
  const pdfBuffer = await generatePDF(html);

  const attachments = [];
  if (pdfBuffer) {
    attachments.push({
      filename: `Daily_Sales_Report_${today.date}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    });
    console.log(`✅ PDF successfully generated and attached (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);
  }

  console.log(`📤 Sending report email to: ${recipients.join(', ')}`);

  const info = await transporter.sendMail({
    from: SMTP_FROM,
    to: recipients.join(', '),
    subject: `📈 Daily Sales & Revenue Report — ${shortDateStr} [${fmtINR(todayRev)}]`,
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

module.exports = { sendDailyReport };
