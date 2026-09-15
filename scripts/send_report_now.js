/**
 * Immediate & Automated Daily Sales Report Email Delivery
 * Restores the beloved card-based layout with spotlight cards, clean charts,
 * embedded official the EleFant logo, PDF attachment, and live dashboard links.
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

function quickChartURL(config, width = 560, height = 260) {
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
  return [
    '"Govind Parmar" <govind.parmar@theelefant.ai>',
    '"Aman Soni" <aman.soni@theelefant.ai>',
    '"Vaaneet Kapoor" <vaaneet.kapoor@theelefant.ai>',
    '"Karan Chadha" <karan.chadha@theelefant.ai>',
    '"Sourabh Jain" <sourabh.jain@theelefant.ai>'
  ];
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
    await page.setViewport({ width: 800, height: 1200, deviceScaleFactor: 2 });
    await page.setContent(pdfHtml, { waitUntil: 'load', timeout: 20000 });
    // small pause to ensure quickcharts render
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

  const today = allData[allData.length - 1];
  const yesterday = allData.length > 1 ? allData[allData.length - 2] : today;

  const d = new Date(today.date + 'T00:00:00');
  const dateStr = d.toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const deliveryTotal = (today.deliveryFee && today.deliveryFee.total > 0) ? today.deliveryFee.total : 0;
  const yesterdayDelivery = (yesterday.deliveryFee && yesterday.deliveryFee.total > 0) ? yesterday.deliveryFee.total : 0;

  const todayRev     = (today.totalRevenue || 0) + deliveryTotal;
  const yesterdayRev = (yesterday.totalRevenue || 0) + yesterdayDelivery;
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

  const organicCount = today.sources?.Organic?.count || 0;
  const organicRev   = today.sources?.Organic?.revenue || 0;

  const renewalCount = (today.sources?.Renewals?.count || 0) + (today.sources?.Upgrade?.count || 0);
  const renewalRev   = (today.sources?.Renewals?.revenue || 0) + (today.sources?.Upgrade?.revenue || 0);

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

  // Trend Chart (last 14 days)
  const recentData = allData.slice(-14);
  const trendChartImg = quickChartURL({
    type: 'line',
    data: {
      labels: recentData.map(entry => formatShortDate(entry.date)),
      datasets: [{
        label: 'Daily Revenue (INR)',
        data: recentData.map(entry => entry.totalRevenue + ((entry.deliveryFee && entry.deliveryFee.total > 0) ? entry.deliveryFee.total : 0)),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.15)',
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: '#4f46e5',
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { font: { size: 10, family: 'Inter, sans-serif' } }, grid: { color: '#f1f5f9' } },
        y: { ticks: { font: { size: 10, family: 'Inter, sans-serif' } }, grid: { color: '#f1f5f9' } },
      },
    },
  }, 560, 240);

  // Plans breakdown
  const plans = today.plans || {};
  const planLabels = Object.keys(plans);
  const planCounts = planLabels.map(p => plans[p].count);
  const planColors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#fb7185', '#8b5cf6', '#ec4899'];
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
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11, family: 'Inter, sans-serif' }, boxWidth: 12, padding: 12 } },
      },
    },
  }, 380, 220);

  // Acquisition Channels
  const sources = today.sources || {};
  const allSourceLabels = Object.keys(sources).filter(s => (sources[s].count > 0 || sources[s].revenue > 0));
  if (deliveryTotal > 0 && !allSourceLabels.includes('Delivery Fee')) {
    allSourceLabels.push('Delivery Fee');
  }

  const sourceColors = {
    'Events': '#6366f1',
    'Organic': '#10b981',
    'Renewals': '#f59e0b',
    'Self Upgrade': '#8b5cf6',
    'TeleCRM': '#06b6d4',
    'Disputed Sales': '#f43f5e',
    'Overlap Sales': '#f43f5e',
    'Delivery Fee': '#64748b'
  };

  const channelChartImg = quickChartURL({
    type: 'bar',
    data: {
      labels: allSourceLabels,
      datasets: [{
        label: 'Revenue (₹)',
        data: allSourceLabels.map(s => s === 'Delivery Fee' ? deliveryTotal : (sources[s]?.revenue || 0)),
        backgroundColor: allSourceLabels.map(s => sourceColors[s] || '#6366f1'),
        borderRadius: 6,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { font: { size: 10, family: 'Inter, sans-serif' } }, grid: { display: false } },
        y: { ticks: { font: { size: 10, family: 'Inter, sans-serif' } }, grid: { color: '#f1f5f9' } },
      },
    },
  }, 560, 240);

  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily Sales & Revenue Report — ${dateStr}</title>
  </head>
  <body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:'Inter',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 8px 30px rgba(0,0,0,0.06);">
      
      <!-- HEADER BANNER WITH OFFICIAL LOGO & DASHBOARD LINK -->
      <div style="background:linear-gradient(135deg,#3730a3 0%,#4f46e5 50%,#6366f1 100%);padding:28px 32px;color:#ffffff;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="vertical-align:middle;">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
                <img src="cid:elefant_logo" alt="The Elefant" style="height:36px;vertical-align:middle;background:#ffffff;padding:4px 8px;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.15);" />
              </div>
              <h1 style="margin:4px 0 0;font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;">📈 Daily Sales &amp; Revenue Report</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.9);font-size:14px;font-weight:500;">${dateStr}</p>
            </td>
            <td style="text-align:right;vertical-align:middle;">
              <a href="${DASHBOARD_URL}" target="_blank" style="display:inline-block;background:#ffffff;color:#4338ca;font-weight:800;font-size:12px;padding:9px 16px;border-radius:8px;text-decoration:none;box-shadow:0 3px 8px rgba(0,0,0,0.15);white-space:nowrap;">
                🚀 Open Dashboard
              </a>
            </td>
          </tr>
        </table>
      </div>

      <!-- 1. KEY PERFORMANCE INDICATORS (YESTERDAY) -->
      <div style="padding:28px 32px 16px;">
        <h2 style="margin:0 0 16px;font-size:16px;color:#0f172a;font-weight:800;letter-spacing:-0.01em;">📊 Key Performance Indicators (Yesterday)</h2>
        <table style="width:100%;border-collapse:separate;border-spacing:10px 10px;margin-left:-10px;margin-right:-10px;">
          <tr>
            <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #10b981;border-radius:8px;padding:14px 16px;vertical-align:top;">
              <div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:4px;">💰 TOTAL REVENUE YESTERDAY</div>
              <div style="font-size:22px;font-weight:900;color:#059669;line-height:1.2;">${fmtINR(todayRev)}</div>
              <div style="font-size:12px;color:${diffColor};font-weight:700;margin-top:6px;">${diffRevStr} vs previous day</div>
            </td>
            <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #6366f1;border-radius:8px;padding:14px 16px;vertical-align:top;">
              <div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:4px;">🤝 DEALS CLOSED YESTERDAY</div>
              <div style="font-size:22px;font-weight:900;color:#1e293b;line-height:1.2;">${todayCount} <span style="font-size:14px;color:#64748b;font-weight:600;">deals</span></div>
              <div style="font-size:12px;color:${diffCountColor};font-weight:700;margin-top:6px;">${diffCountStr} deals vs previous day</div>
            </td>
          </tr>
          <tr>
            <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #06b6d4;border-radius:8px;padding:14px 16px;vertical-align:top;">
              <div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:4px;">📊 AVERAGE DEAL SIZE (AOV)</div>
              <div style="font-size:20px;font-weight:800;color:#1e293b;line-height:1.2;">${fmtINR(todayAOV)}</div>
              <div style="font-size:12px;color:${diffAOVColor};font-weight:700;margin-top:6px;">${diffAOVStr} vs previous day</div>
            </td>
            <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 16px;vertical-align:top;">
              <div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:4px;">🌱 ORGANIC DEALS</div>
              <div style="font-size:20px;font-weight:800;color:#1e293b;line-height:1.2;">${organicCount} <span style="font-size:13px;color:#64748b;font-weight:600;">deals</span></div>
              <div style="font-size:12px;color:#059669;font-weight:700;margin-top:6px;">${fmtINR(organicRev)} generated</div>
            </td>
          </tr>
          <tr>
            <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #8b5cf6;border-radius:8px;padding:14px 16px;vertical-align:top;">
              <div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:4px;">🔄 RENEWALS &amp; UPGRADES</div>
              <div style="font-size:20px;font-weight:800;color:#1e293b;line-height:1.2;">${renewalCount} <span style="font-size:13px;color:#64748b;font-weight:600;">deals</span></div>
              <div style="font-size:12px;color:#059669;font-weight:700;margin-top:6px;">${fmtINR(renewalRev)} generated</div>
            </td>
            <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #f43f5e;border-radius:8px;padding:14px 16px;vertical-align:top;">
              <div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:4px;">👑 TOP SALES AGENT (MTD)</div>
              <div style="font-size:20px;font-weight:800;color:#1e293b;line-height:1.2;">${topAgent[0].split(' ')[0]}</div>
              <div style="font-size:12px;color:#059669;font-weight:700;margin-top:6px;">${fmtINR(topAgent[1].revenue)} (${topAgent[1].count} deals)</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- 2. D-o-D USER FUNNEL BREAKDOWN -->
      ${today.userBreakdown ? `
      <div style="padding:0 32px 24px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <h2 style="margin:0;font-size:16px;color:#0f172a;font-weight:800;letter-spacing:-0.01em;">👥 D-o-D User Breakdown</h2>
          <span style="font-size:11px;background:#e0e7ff;color:#4338ca;padding:3px 10px;border-radius:12px;font-weight:700;">Conversion Funnel</span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#f1f5f9;color:#475569;text-align:left;">
              <th style="padding:9px 12px;font-weight:700;">Funnel Metric</th>
              <th style="padding:9px 12px;text-align:center;font-weight:700;">Count / %</th>
              <th style="padding:9px 12px;text-align:right;font-weight:700;">Stage</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:9px 12px;font-weight:700;color:#1e293b;">📝 Signups</td>
              <td style="padding:9px 12px;text-align:center;font-weight:800;color:#4338ca;">${today.userBreakdown.signups.toLocaleString('en-IN')}</td>
              <td style="padding:9px 12px;text-align:right;color:#64748b;font-weight:600;">Total Registrations</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:9px 12px;font-weight:700;color:#1e293b;">📍 Serviceable</td>
              <td style="padding:9px 12px;text-align:center;font-weight:800;color:#0284c7;">${today.userBreakdown.serviceable.toLocaleString('en-IN')} <span style="font-size:11px;color:#0284c7;font-weight:600;">(${today.userBreakdown.serviceablePct})</span></td>
              <td style="padding:9px 12px;text-align:right;color:#64748b;font-weight:600;">% of Signups</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:9px 12px;font-weight:700;color:#1e293b;">🧸 Toy Viewed</td>
              <td style="padding:9px 12px;text-align:center;font-weight:800;color:#059669;">${today.userBreakdown.toyViewed}</td>
              <td style="padding:9px 12px;text-align:right;color:#64748b;font-weight:600;">% of Serviceable</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:9px 12px;font-weight:700;color:#1e293b;">📋 Plan Page</td>
              <td style="padding:9px 12px;text-align:center;font-weight:800;color:#2563eb;">${today.userBreakdown.planPage}</td>
              <td style="padding:9px 12px;text-align:right;color:#64748b;font-weight:600;">% of Serviceable</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:9px 12px;font-weight:700;color:#1e293b;">🛒 Checkout Drop</td>
              <td style="padding:9px 12px;text-align:center;font-weight:800;color:#d97706;">${today.userBreakdown.checkoutDrop}</td>
              <td style="padding:9px 12px;text-align:right;color:#64748b;font-weight:600;">Cart Abandonment</td>
            </tr>
            <tr>
              <td style="padding:9px 12px;font-weight:700;color:#1e293b;">💳 Total Conversions</td>
              <td style="padding:9px 12px;text-align:center;font-weight:800;color:#059669;">${today.userBreakdown.conversions}</td>
              <td style="padding:9px 12px;text-align:right;color:#059669;font-weight:700;">Subscribed Users</td>
            </tr>
          </tbody>
        </table>
      </div>
      ` : ''}

      <!-- 3. REVENUE TREND CHART -->
      <div style="padding:0 32px 24px;">
        <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a;font-weight:800;">📈 Revenue Performance Trend</h2>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center;">
          <img src="${trendChartImg}" alt="Revenue Trend" style="width:100%;max-width:560px;height:auto;display:block;margin:0 auto;border-radius:6px;" />
        </div>
      </div>

      <!-- 4. SUBSCRIPTION PLAN PERFORMANCE -->
      <div style="padding:0 32px 24px;">
        <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a;font-weight:800;">📦 Subscription Plan Performance</h2>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:12px;text-align:center;">
          <img src="${planChartImg}" alt="Plan Distribution" style="width:100%;max-width:380px;height:auto;display:block;margin:0 auto;border-radius:6px;" />
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#f1f5f9;color:#475569;text-align:left;">
              <th style="padding:9px 12px;font-weight:700;">Plan Name</th>
              <th style="padding:9px 12px;text-align:center;font-weight:700;">Subscriptions</th>
              <th style="padding:9px 12px;text-align:right;font-weight:700;">Revenue</th>
              <th style="padding:9px 12px;text-align:right;font-weight:700;">Share</th>
            </tr>
          </thead>
          <tbody>
            ${planLabels.map((p) => {
              const pData = plans[p] || { count: 0, revenue: 0 };
              const pShare = todayRev > 0 ? ((pData.revenue / todayRev) * 100).toFixed(1) : 0;
              return `
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:9px 12px;font-weight:600;color:#1e293b;">${p}</td>
                  <td style="padding:9px 12px;text-align:center;color:#64748b;font-weight:600;">${pData.count}</td>
                  <td style="padding:9px 12px;text-align:right;font-weight:700;color:#059669;">${fmtINR(pData.revenue)}</td>
                  <td style="padding:9px 12px;text-align:right;color:#64748b;font-weight:600;">${pShare}%</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- 5. ACQUISITION CHANNELS -->
      <div style="padding:0 32px 24px;">
        <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a;font-weight:800;">📊 Sales by Acquisition Channel</h2>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:12px;text-align:center;">
          <img src="${channelChartImg}" alt="Acquisition Channels" style="width:100%;max-width:560px;height:auto;display:block;margin:0 auto;border-radius:6px;" />
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#f1f5f9;color:#475569;text-align:left;">
              <th style="padding:9px 12px;font-weight:700;">Channel Source</th>
              <th style="padding:9px 12px;text-align:center;font-weight:700;">Deals Count</th>
              <th style="padding:9px 12px;text-align:right;font-weight:700;">Revenue</th>
            </tr>
          </thead>
          <tbody>
            ${allSourceLabels.map((s) => {
              const sCount = s === 'Delivery Fee' ? (today.deliveryFee?.count || 0) : (sources[s]?.count || 0);
              const sRev = s === 'Delivery Fee' ? deliveryTotal : (sources[s]?.revenue || 0);
              return `
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:9px 12px;font-weight:600;color:#1e293b;">${s}</td>
                  <td style="padding:9px 12px;text-align:center;color:#64748b;font-weight:600;">${sCount}</td>
                  <td style="padding:9px 12px;text-align:right;font-weight:700;color:#059669;">${fmtINR(sRev)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- 6. TOP PERFORMING SALES AGENTS THIS MONTH -->
      <div style="padding:0 32px 28px;">
        <h2 style="margin:0 0 14px;font-size:16px;color:#0f172a;font-weight:800;">🏆 Top Performing Sales Agents (This Month)</h2>
        
        ${sortedAgents.length > 0 ? `
        <!-- Top Performer Spotlight Card -->
        <div style="background:linear-gradient(135deg,#fef9c3 0%,#fef08a 50%,#fde047 100%);border:2px solid #f59e0b;border-radius:12px;padding:18px 22px;margin-bottom:16px;box-shadow:0 4px 14px rgba(245,158,11,0.18);">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="vertical-align:middle;">
                <div style="display:inline-block;background:#b45309;color:#ffffff;font-size:10px;font-weight:800;padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">
                  👑 TOP PERFORMER OF THE MONTH
                </div>
                <div style="display:flex;align-items:center;gap:12px;margin-top:4px;">
                  <div style="width:44px;height:44px;background:#d97706;border-radius:50%;color:#ffffff;font-weight:800;font-size:16px;text-align:center;line-height:44px;border:2px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
                    ${topAgentInitials}
                  </div>
                  <div>
                    <h3 style="margin:0;font-size:19px;font-weight:900;color:#78350f;letter-spacing:-0.01em;">${topAgent[0]}</h3>
                    <div style="font-size:12px;color:#92400e;font-weight:600;margin-top:2px;">
                      🎯 ${topAgent[1].count} deal${topAgent[1].count > 1 ? 's' : ''} closed • 📈 ${topAgentPct}% of month's revenue
                    </div>
                  </div>
                </div>
              </td>
              <td style="text-align:right;vertical-align:middle;padding-left:16px;">
                <div style="font-size:11px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Total Revenue</div>
                <div style="font-size:24px;font-weight:900;color:#065f46;line-height:1.2;">${fmtINR(topAgent[1].revenue)}</div>
              </td>
            </tr>
          </table>
        </div>
        ` : ''}

        <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0;text-align:left;color:#475569;">
              <th style="padding:9px 12px;font-weight:700;width:80px;">Rank</th>
              <th style="padding:9px 12px;font-weight:700;">Agent Name</th>
              <th style="padding:9px 12px;text-align:center;font-weight:700;">Deals</th>
              <th style="padding:9px 12px;text-align:right;font-weight:700;">Revenue Closed</th>
            </tr>
          </thead>
          <tbody>
            ${sortedAgents.map(([agent, val], idx) => {
              const rank = idx + 1;
              const badgeBg = rank === 1 ? '#fef3c7' : rank === 2 ? '#e2e8f0' : rank === 3 ? '#ffedd5' : '#f1f5f9';
              const badgeColor = rank === 1 ? '#b45309' : rank === 2 ? '#475569' : rank === 3 ? '#c2410c' : '#64748b';
              return `
                <tr style="border-bottom:1px solid #f1f5f9;${rank === 1 ? 'background:#fffbeb;' : ''}">
                  <td style="padding:9px 12px;">
                    <span style="display:inline-block;background:${badgeBg};color:${badgeColor};font-weight:800;font-size:11px;padding:2px 8px;border-radius:10px;">
                      ${rank === 1 ? '🏆 #1' : '#' + rank}
                    </span>
                  </td>
                  <td style="padding:9px 12px;font-weight:600;color:#1e293b;">${agent}</td>
                  <td style="padding:9px 12px;text-align:center;color:#64748b;font-weight:600;">${val.count}</td>
                  <td style="padding:9px 12px;text-align:right;font-weight:700;color:#059669;">${fmtINR(val.revenue)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- FOOTER -->
      <div style="background:#f8fafc;padding:24px 32px;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;line-height:1.6;">
        <div style="margin-bottom:10px;">
          <a href="${DASHBOARD_URL}" target="_blank" style="display:inline-block;background:#4f46e5;color:#ffffff;font-weight:700;font-size:12px;padding:8px 18px;border-radius:6px;text-decoration:none;box-shadow:0 2px 6px rgba(79,70,229,0.25);">
            📊 View Full Interactive Live Dashboard
          </a>
        </div>
        Automated Daily Sales Intelligence Report • Attached PDF report generated for records<br />
        <strong>Daily Sales &amp; Revenue Analytics Dashboard System</strong>
      </div>
    </div>
  </body>
  </html>
  `;

  return { html, dateStr, todayRev, todayDate: today.date };
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

  const { html, dateStr, todayRev, todayDate } = buildEmailHtml(allData);

  // Write email preview for easy browser debugging
  const previewPath = path.join(__dirname, '..', 'public', 'email_preview.html');
  fs.writeFileSync(previewPath, html, 'utf-8');
  console.log('💾 Saved local email preview to public/email_preview.html');

  // Generate PDF attachment
  console.log('📄 Generating PDF attachment with Puppeteer...');
  const pdfBuffer = await generatePDF(html);

  const attachments = [];
  const logoPath = path.join(__dirname, '..', 'public', 'elefant-logo.png');
  if (fs.existsSync(logoPath)) {
    attachments.push({
      filename: 'elefant-logo.png',
      path: logoPath,
      cid: 'elefant_logo'
    });
  }

  if (pdfBuffer) {
    attachments.push({
      filename: `Daily_Sales_Report_${todayDate}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    });
    console.log(`📎 Attached Daily_Sales_Report_${todayDate}.pdf (${Math.round(pdfBuffer.length / 1024)} KB)`);
  }

  const recipients = getRecipients();
  const toList = recipients.join(', ');

  console.log(`📤 Sending report email from ${process.env.SMTP_USER} to: ${toList}`);

  const info = await transporter.sendMail({
    from: SMTP_FROM,
    to: toList,
    subject: `📈 Daily Sales & Revenue Report — ${dateStr} [${fmtINR(todayRev)}]`,
    html,
    attachments,
  });

  console.log(`✅ Email Successfully Sent! Message ID: ${info.messageId}`);
  return info;
}

sendDailyReport().then(() => process.exit(0)).catch(err => {
  console.error('❌ Failed to send email:', err);
  process.exit(1);
});
