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

const fmt = n => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const sd = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
const fd = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const ini = n => n.split(' ').map(x => x[0]).join('').substring(0, 2).toUpperCase();

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
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 850, height: 1200, deviceScaleFactor: 2 });
    await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });
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
    'Self Upgrade': '#8b5cf6'
  };
  const SRC_L = {
    Organic: '🤝 Inside Sales',
    Events: '🎤 Events',
    Renewals: '🔄 Renewals',
    Upgrade: '⬆️ Upgrades',
    'Self Subscription': '📱 Self Sub',
    'Direct Sale': '🛍️ Direct Sale',
    'Self Upgrade': '🚀 Self Upgrade'
  };

  const sourcesList = Object.entries(yd.sources || {}).sort((a, b) => b[1].revenue - a[1].revenue);

  // Overlap deals
  const disp = yd.disputedTotal || yd.collidingTotal || { count: 0, revenue: 0 };

  // Highest Sale
  const hsAmount = yd.highestSale?.amount ? fmt(yd.highestSale.amount) : '—';
  const hsAgent = yd.highestSale?.agent ? `Closed by ${yd.highestSale.agent}` : '—';

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

  // 5. Period Revenue (Week to Date & Month to Date)
  const ydDateObj = new Date(yd.date + 'T00:00:00');
  const dayOfWeek = ydDateObj.getDay(); // 0 = Sun, 1 = Mon ...
  const weekStartObj = new Date(ydDateObj);
  weekStartObj.setDate(ydDateObj.getDate() - dayOfWeek);
  const weekStartStr = weekStartObj.toISOString().split('T')[0];

  const monthStartStr = yd.date.slice(0, 7) + '-01';

  const weekDays = allData.filter(d => d.date >= weekStartStr && d.date <= yd.date);
  const monthDays = allData.filter(d => d.date >= monthStartStr && d.date <= yd.date);

  const weekSales = weekDays.reduce((s, d) => s + (d.totalRevenue || 0), 0);
  const weekDelivery = weekDays.reduce((s, d) => s + ((d.deliveryFee && d.deliveryFee.total > 0) ? d.deliveryFee.total : 0), 0);
  const weekGrand = weekSales + weekDelivery;
  const weekDeals = weekDays.reduce((s, d) => s + (d.salesCount || 0), 0);

  const monthSales = monthDays.reduce((s, d) => s + (d.totalRevenue || 0), 0);
  const monthDelivery = monthDays.reduce((s, d) => s + ((d.deliveryFee && d.deliveryFee.total > 0) ? d.deliveryFee.total : 0), 0);
  const monthGrand = monthSales + monthDelivery;
  const monthDeals = monthDays.reduce((s, d) => s + (d.salesCount || 0), 0);

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
  <div style="max-width:700px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid rgba(109,40,217,0.12);box-shadow:0 8px 30px rgba(109,40,217,0.1);">
    
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

    <!-- 4. PERIOD REVENUE -->
    <div style="padding:0 28px 18px;">
      <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:10px;">
        📆 Period Revenue
      </div>
      <table style="width:100%;border-collapse:separate;border-spacing:10px 10px;margin-left:-10px;margin-right:-10px;">
        <tr>
          <td style="width:50%;background:#ffffff;border:1px solid rgba(109,40,217,0.15);border-radius:10px;padding:14px;vertical-align:top;">
            <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;">Revenue This Week (Sun–Yesterday)</div>
            <div style="font-size:22px;font-weight:900;color:#059669;margin-top:2px;">${fmt(weekGrand)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">${weekDeals} deals • ${weekDays.length} days</div>
          </td>
          <td style="width:50%;background:#ffffff;border:1px solid rgba(109,40,217,0.15);border-radius:10px;padding:14px;vertical-align:top;">
            <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;">Revenue This Month (1st–Yesterday)</div>
            <div style="font-size:22px;font-weight:900;color:#7c3aed;margin-top:2px;">${fmt(monthGrand)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">${monthDeals} deals • ${monthDays.length} days</div>
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
  console.log('🔄 Syncing live data before building report email...');
  let allData;
  try {
    allData = await syncSalesData();
  } catch (err) {
    console.warn('⚠️ Could not sync live data, using local data.json:', err.message);
    const dataPath = path.join(__dirname, '..', 'data', 'data.json');
    allData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  }

  const html = buildEmailHtml(allData);
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

  console.log(`📤 Sending report email to: ${recipients.join(', ')}`);

  const info = await transporter.sendMail({
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
