/**
 * ============================================================
 *  Daily Sales & Revenue Report — Express Backend
 *
 *  Features:
 *    • Serves /public static files & /data/data.json
 *    • POST /api/send-report — sends the formatted HTML email with charts
 *    • node-cron job: auto-sends the daily sales report at 10:00 AM IST
 * ============================================================
 */

require('dotenv').config();
const express    = require('express');
const path       = require('path');
const fs          = require('fs');
const nodemailer  = require('nodemailer');
const cron        = require('node-cron');
const compression = require('compression');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ---------- Middleware ---------- */
app.use(compression());
app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ---------- Static files ---------- */
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/data', express.static(path.join(__dirname, '..', 'data')));

/* ---------- Nodemailer Transporter ---------- */
const SMTP_USER = process.env.SMTP_USER || 'aman.soni@theelefant.ai';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || '"Aman Soni" <aman.soni@theelefant.ai>';

const transporter = process.env.DISABLE_EMAIL === 'true' ? {
  sendMail: async (options) => {
    console.log('[DRY RUN] Would have sent email to:', options.to);
    return { messageId: 'dry-run-id' };
  }
} : nodemailer.createTransport({
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

/* ---------- Helpers ---------- */
function getRecipients() {
  const filePath = path.join(__dirname, '..', 'config', 'employees.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { recipients } = JSON.parse(raw);
  return recipients;
}

function getAllReportData() {
  const filePath = path.join(__dirname, '..', 'data', 'data.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  data.sort((a, b) => a.date.localeCompare(b.date));
  return data;
}

function fmtINR(num) {
  return '₹' + Math.round(num || 0).toLocaleString('en-IN');
}

function formatShortDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function quickChartURL(config, width = 560, height = 280) {
  const json = JSON.stringify(config);
  return `https://quickchart.io/chart?c=${encodeURIComponent(json)}&w=${width}&h=${height}&bkg=white&f=png`;
}

/**
 * Server-side HTML Builder for Cron 10:00 AM automated email
 */
function buildEmailHTMLServer(allData) {
  const today = allData[allData.length - 1];
  const yesterday = allData.length > 1 ? allData[allData.length - 2] : today;

  const d = new Date(today.date + 'T00:00:00');
  const dateStr = d.toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const todayRev     = today.totalRevenue || 0;
  const yesterdayRev = yesterday.totalRevenue || 0;
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

  // Chart 1: Revenue Trend Line Chart
  const trendChartImg = quickChartURL({
    type: 'line',
    data: {
      labels: allData.map(d => formatShortDate(d.date)),
      datasets: [{
        label: 'Daily Revenue (INR)',
        data: allData.map(d => d.totalRevenue),
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
  }, 560, 240);

  // Chart 2: Plan Mix Doughnut Chart
  const plans = today.plans || {};
  const planLabels = Object.keys(plans);
  const planCounts = planLabels.map(p => plans[p].count);
  const totalPlanCount = planCounts.reduce((a, b) => a + b, 0);
  const totalPlanRev = planLabels.reduce((sum, l) => sum + (plans[l]?.revenue || 0), 0);
  const planColors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#fb7185', '#8b5cf6'];
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
        datalabels: {
          display: true,
          color: '#ffffff',
          font: { weight: 'bold', size: 12, family: 'Inter, sans-serif' },
          formatter: (val) => {
            const pct = totalPlanCount > 0 ? Math.round((val / totalPlanCount) * 100) : 0;
            return pct >= 8 ? `${val} (${pct}%)` : '';
          },
        },
        doughnutlabel: {
          labels: [
            { text: `${totalPlanCount} Deals`, font: { size: 18, weight: 'bold', family: 'Inter, sans-serif' }, color: '#0f172a' },
            { text: fmtINR(totalPlanRev), font: { size: 12, weight: 'bold', family: 'Inter, sans-serif' }, color: '#059669' },
          ],
        },
        legend: {
          position: 'bottom',
          labels: { font: { size: 11, family: 'Inter, sans-serif' }, boxWidth: 12, padding: 12 },
        },
      },
    },
  }, 560, 260);

  // Chart 3: Acquisition Channels Bar Chart
  const sources = today.sources || {};
  const sourceLabels = Object.keys(sources);
  const sourceRevs = sourceLabels.map(s => sources[s].revenue);
  const sourceCounts = sourceLabels.map(s => sources[s].count);
  const sourceColors = ['#10b981', '#6366f1', '#06b6d4', '#f59e0b'];
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
        datalabels: {
          display: true,
          anchor: 'end',
          align: 'top',
          color: '#059669',
          font: { weight: 'bold', size: 11, family: 'Inter, sans-serif' },
          formatter: (val, ctx) => {
            const count = sourceCounts[ctx.dataIndex];
            return `${fmtINR(val)} (${count}d)`;
          },
        },
      },
      scales: {
        x: { ticks: { font: { size: 10, family: 'Inter, sans-serif' } }, grid: { display: false } },
        y: { ticks: { font: { size: 10, family: 'Inter, sans-serif' } }, grid: { color: '#f1f5f9' }, grace: '15%' },
      },
    },
  }, 560, 240);

  return `
  <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;max-width:680px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 8px 30px rgba(0,0,0,0.06);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4338ca 0%,#6366f1 100%);padding:30px 32px;color:#ffffff;">
      <div>
        <h1 style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.02em;">📈 Daily Sales &amp; Revenue Report</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.9);font-size:14px;font-weight:500;">${dateStr}</p>
      </div>
    </div>

    <!-- ================= 1. EXECUTIVE KPI SUMMARY CARDS ================= -->
    <div style="padding:28px 32px 16px;">
      <h2 style="margin:0 0 16px;font-size:16px;color:#0f172a;font-weight:800;letter-spacing:-0.01em;">📊 Key Performance Indicators (Today)</h2>
      
      <table style="width:100%;border-collapse:separate;border-spacing:10px 10px;margin-left:-10px;margin-right:-10px;">
        <tr>
          <!-- KPI 1: Revenue -->
          <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #10b981;border-radius:8px;padding:14px 16px;vertical-align:top;">
            <div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:4px;">💰 TOTAL REVENUE TODAY</div>
            <div style="font-size:22px;font-weight:900;color:#059669;line-height:1.2;">${fmtINR(todayRev)}</div>
            <div style="font-size:12px;color:${diffColor};font-weight:700;margin-top:6px;">${diffRevStr} vs yesterday</div>
          </td>
          <!-- KPI 2: Deals Closed -->
          <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #6366f1;border-radius:8px;padding:14px 16px;vertical-align:top;">
            <div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:4px;">🤝 DEALS CLOSED TODAY</div>
            <div style="font-size:22px;font-weight:900;color:#1e293b;line-height:1.2;">${todayCount} <span style="font-size:14px;color:#64748b;font-weight:600;">deals</span></div>
            <div style="font-size:12px;color:${diffCountColor};font-weight:700;margin-top:6px;">${diffCountStr} deals vs yesterday</div>
          </td>
        </tr>
        <tr>
          <!-- KPI 3: AOV -->
          <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #06b6d4;border-radius:8px;padding:14px 16px;vertical-align:top;">
            <div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:4px;">📊 AVERAGE DEAL SIZE (AOV)</div>
            <div style="font-size:20px;font-weight:800;color:#1e293b;line-height:1.2;">${fmtINR(todayAOV)}</div>
            <div style="font-size:12px;color:${diffAOVColor};font-weight:700;margin-top:6px;">${diffAOVStr} vs yesterday</div>
          </td>
          <!-- KPI 4: Organic Deals -->
          <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 16px;vertical-align:top;">
            <div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:4px;">🌱 ORGANIC DEALS</div>
            <div style="font-size:20px;font-weight:800;color:#1e293b;line-height:1.2;">${organicCount} <span style="font-size:13px;color:#64748b;font-weight:600;">deals</span></div>
            <div style="font-size:12px;color:#059669;font-weight:700;margin-top:6px;">${fmtINR(organicRev)} generated</div>
          </td>
        </tr>
        <tr>
          <!-- KPI 5: Renewals / Upgrades -->
          <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #8b5cf6;border-radius:8px;padding:14px 16px;vertical-align:top;">
            <div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:4px;">🔄 RENEWALS &amp; UPGRADES</div>
            <div style="font-size:20px;font-weight:800;color:#1e293b;line-height:1.2;">${renewalCount} <span style="font-size:13px;color:#64748b;font-weight:600;">deals</span></div>
            <div style="font-size:12px;color:#059669;font-weight:700;margin-top:6px;">${fmtINR(renewalRev)} generated</div>
          </td>
          <!-- KPI 6: Top Agent -->
          <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #f43f5e;border-radius:8px;padding:14px 16px;vertical-align:top;">
            <div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:4px;">👑 TOP SALES AGENT</div>
            <div style="font-size:20px;font-weight:800;color:#1e293b;line-height:1.2;">${topAgent[0].split(' ')[0]}</div>
            <div style="font-size:12px;color:#059669;font-weight:700;margin-top:6px;">${fmtINR(topAgent[1].revenue)} (${topAgent[1].count} deals)</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- ================= 2. D-o-D USER BREAKDOWN ================= -->
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
            <td style="padding:9px 12px;text-align:right;color:#64748b;font-weight:600;">% of Serviceable</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:9px 12px;font-weight:700;color:#1e293b;">💳 Payment Dropout</td>
            <td style="padding:9px 12px;text-align:center;font-weight:800;color:#e11d48;">${today.userBreakdown.paymentDropout}</td>
            <td style="padding:9px 12px;text-align:right;color:#64748b;font-weight:600;">% of Serviceable</td>
          </tr>
          <tr>
            <td style="padding:9px 12px;font-weight:700;color:#1e293b;">🏆 Won</td>
            <td style="padding:9px 12px;text-align:center;font-weight:900;color:#059669;background:#f0fdf4;">${today.userBreakdown.won}</td>
            <td style="padding:9px 12px;text-align:right;color:#059669;font-weight:700;background:#f0fdf4;">% of Serviceable</td>
          </tr>
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- ================= 3. DAILY REVENUE TREND CHART ================= -->
    <div style="padding:16px 32px 24px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <h2 style="margin:0;font-size:16px;color:#0f172a;font-weight:800;">📈 Daily Revenue Trend (Month to Date)</h2>
        <span style="font-size:11px;background:#e0e7ff;color:#4338ca;padding:3px 8px;border-radius:12px;font-weight:700;">August 2026</span>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center;">
        <img src="${trendChartImg}" alt="Daily Revenue Trend" style="width:100%;max-width:580px;height:auto;display:block;margin:0 auto;border-radius:6px;" />
      </div>
    </div>

    <!-- ================= 3. PLAN MIX BREAKDOWN ================= -->
    <div style="padding:0 32px 24px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <h2 style="margin:0;font-size:16px;color:#0f172a;font-weight:800;">🥧 Plan Mix &amp; Volume Breakdown</h2>
        <span style="font-size:11px;background:#e0e7ff;color:#4338ca;padding:3px 8px;border-radius:12px;font-weight:700;">By Volume</span>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:12px;text-align:center;">
        <img src="${planChartImg}" alt="Plan Mix Distribution" style="width:100%;max-width:480px;height:auto;display:block;margin:0 auto;border-radius:6px;" />
      </div>
      <!-- Plan Mix Table -->
      <table style="width:100%;border-collapse:collapse;font-size:13px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f1f5f9;color:#475569;text-align:left;">
            <th style="padding:9px 12px;font-weight:700;">Plan Name</th>
            <th style="padding:9px 12px;text-align:center;font-weight:700;">Deals Count</th>
            <th style="padding:9px 12px;text-align:right;font-weight:700;">Revenue</th>
            <th style="padding:9px 12px;text-align:right;font-weight:700;">Share</th>
          </tr>
        </thead>
        <tbody>
          ${planLabels.map((p, idx) => {
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

    <!-- ================= 4. SALES BY ACQUISITION CHANNEL ================= -->
    <div style="padding:0 32px 24px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <h2 style="margin:0;font-size:16px;color:#0f172a;font-weight:800;">📊 Sales by Acquisition Channel</h2>
        <span style="font-size:11px;background:#e0e7ff;color:#4338ca;padding:3px 8px;border-radius:12px;font-weight:700;">Revenue by Source</span>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:12px;text-align:center;">
        <img src="${channelChartImg}" alt="Acquisition Channels" style="width:100%;max-width:580px;height:auto;display:block;margin:0 auto;border-radius:6px;" />
      </div>
      <!-- Channel Table -->
      <table style="width:100%;border-collapse:collapse;font-size:13px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f1f5f9;color:#475569;text-align:left;">
            <th style="padding:9px 12px;font-weight:700;">Channel Source</th>
            <th style="padding:9px 12px;text-align:center;font-weight:700;">Deals Count</th>
            <th style="padding:9px 12px;text-align:right;font-weight:700;">Revenue</th>
          </tr>
        </thead>
        <tbody>
          ${sourceLabels.map((s) => {
            const sData = sources[s] || { count: 0, revenue: 0 };
            return `
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:9px 12px;font-weight:600;color:#1e293b;">${s}</td>
                <td style="padding:9px 12px;text-align:center;color:#64748b;font-weight:600;">${sData.count}</td>
                <td style="padding:9px 12px;text-align:right;font-weight:700;color:#059669;">${fmtINR(sData.revenue)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- ================= 5. TOP PERFORMING SALES AGENTS THIS MONTH ================= -->
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
                <div style="width:44px;height:44px;background:#d97706;border-radius:50%;color:#ffffff;font-weight:800;font-size:16px;text-align:center;line-height:44px;border:2px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.15);position:relative;">
                  ${topAgentInitials}
                  <span style="position:absolute;bottom:-2px;right:-2px;background:#0f172a;border-radius:50%;font-size:11px;line-height:16px;width:16px;height:16px;display:block;border:1px solid #fbbf24;">🏆</span>
                </div>
                <div>
                  <h3 style="margin:0;font-size:19px;font-weight:900;color:#78350f;letter-spacing:-0.01em;">${topAgent[0]}</h3>
                  <div style="font-size:12px;color:#92400e;font-weight:600;margin-top:2px;">
                    🎯 ${topAgent[1].count} deal${topAgent[1].count > 1 ? 's' : ''} closed • 📈 ${topAgentPct}% of this month's revenue
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

      <!-- Other Agents Leaderboard Table -->
      <div style="margin-top:12px;">
        <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">
          Team Standings &amp; Rankings
        </div>
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

      <!-- 9. REFUNDS -->
      <div style="margin-bottom:28px;">
        <div style="font-size:12px;font-weight:800;color:#5b3e9b;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:12px;">
          💸 REFUNDS
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;">
          <tr>
            <td width="48%" valign="top" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
              <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">
                REFUND PROCESSED (YESTERDAY)
              </div>
              <div style="font-size:24px;font-weight:800;color:#0f172a;">
                ${fmtINR(yesterday.refunds?.total || 0)}
              </div>
              <div style="font-size:11.5px;color:#64748b;margin-top:4px;">
                ${yesterday.refunds?.count || 0} refunds processed yesterday
              </div>
            </td>
            <td width="4%"></td>
            <td width="48%" valign="top" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
              <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">
                REFUND PROCESSED (LAST 7 DAYS)
              </div>
              <div style="font-size:24px;font-weight:800;color:#0f172a;">
                ${fmtINR(yesterday.refundsLast7Days?.total || 0)}
              </div>
              <div style="font-size:11.5px;color:#64748b;margin-top:4px;">
                ${yesterday.refundsLast7Days?.count || 0} refunds across rolling 7 days
              </div>
            </td>
          </tr>
        </table>
      </div>

      <!-- 10. FINANCIALS -->
      <div style="margin-bottom:28px;">
        <div style="font-size:12px;font-weight:800;color:#5b3e9b;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:12px;">
          💼 FINANCIALS
        </div>
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;max-width:540px;">
          <div style="padding:14px 18px;font-size:14px;font-weight:800;color:#0f172a;">
            🧲 Net Revenue
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr style="border-top:1px solid #f1f5f9;">
              <td style="padding:10px 18px;font-size:13px;color:#64748b;font-weight:600;">Total Sales Revenue</td>
              <td style="padding:10px 18px;font-size:15px;color:#059669;font-weight:800;text-align:right;">${fmtINR((yesterday.totalRevenue || 0) + (yesterday.deliveryFee?.total || 0))}</td>
            </tr>
            <tr style="border-top:1px solid #f1f5f9;">
              <td style="padding:10px 18px;font-size:13px;color:#64748b;font-weight:600;">− Refunds Processed</td>
              <td style="padding:10px 18px;font-size:14px;color:#e11d48;font-weight:700;text-align:right;">− ${fmtINR(yesterday.refunds?.total || 0)}</td>
            </tr>
            <tr style="border-top:1px solid #e2e8f0;background:#f0fdf4;">
              <td style="padding:12px 18px;font-size:13.5px;color:#0f172a;font-weight:800;">= Net Revenue</td>
              <td style="padding:12px 18px;font-size:16px;color:#059669;font-weight:900;text-align:right;">${fmtINR(((yesterday.totalRevenue || 0) + (yesterday.deliveryFee?.total || 0)) - (yesterday.refunds?.total || 0))}</td>
            </tr>
          </table>
        </div>
      </div>

    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:20px 32px;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;line-height:1.5;">
      Automated Daily Sales Intelligence Report • Generated at 10:00 AM IST<br />
      Daily Sales &amp; Revenue Analytics Dashboard System
    </div>
  </div>`;
}

/* ---------- API Routes ---------- */
app.post('/api/send-report', async (req, res) => {
  try {
    const { subject, html } = req.body;

    if (!subject || !html) {
      return res.status(400).json({ error: 'Missing subject or html in request body.' });
    }

    const recipients = getRecipients();
    const toList = recipients.map(r => `"${r.name}" <${r.email}>`).join(', ');

    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to: toList,
      subject,
      html,
    });

    console.log(`✅ Report sent — Message ID: ${info.messageId}`);
    res.json({ success: true, messageId: info.messageId, recipientCount: recipients.length });
  } catch (err) {
    console.error('❌ Email send error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* ---------- Live Google Sheets Sync Route ---------- */
app.post('/api/sync-sheets', async (req, res) => {
  try {
    const { syncSalesData } = require('../scripts/sync_sheets');
    const data = await syncSalesData();
    res.json({ success: true, count: data.length, latestDate: data[data.length - 1]?.date });
  } catch (err) {
    console.error('❌ Sheets sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sync-sheets', async (req, res) => {
  try {
    const { syncSalesData } = require('../scripts/sync_sheets');
    const data = await syncSalesData();
    res.json({ success: true, count: data.length, latestDate: data[data.length - 1]?.date });
  } catch (err) {
    console.error('❌ Sheets sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ---------- Direct HTML Report Render API ---------- */
const handleReportHtml = async (req, res) => {
  try {
    let allData;
    try {
      const { syncSalesData } = require('../scripts/sync_sheets');
      allData = await syncSalesData();
    } catch (syncErr) {
      console.warn('⚠️ Could not sync live data, using existing data.json:', syncErr.message);
      allData = getAllReportData();
    }

    if (!allData || allData.length === 0) {
      return res.status(500).send('<h3>No sales data available.</h3>');
    }

    const html = buildEmailHTMLServer(allData);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Daily Sales & Revenue Report</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { margin: 0; padding: 20px; background: #0f172a; display: flex; justify-content: center; }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `);
  } catch (err) {
    console.error('❌ Error generating report HTML:', err);
    res.status(500).send(`<pre>Error generating report: ${err.message}</pre>`);
  }
};

app.get('/api/report-html', handleReportHtml);
app.post('/api/report-html', handleReportHtml);

/* ---------- Active Subscriptions CSV Endpoint ---------- */
const ACTIVE_SUBS_METABASE_URL = 'https://metabase-bkp.theelefant.ai/public/question/06440078-3d94-4759-974e-0d4b59eccaa5.csv';
const ACTIVE_SUBS_CACHE_FILE = path.join(__dirname, '..', 'data', 'active_subscriptions.csv');

app.get('/api/active-subscriptions-csv', async (req, res) => {
  try {
    const https = require('https');
    function fetchRedirect(url) {
      return new Promise((resolve, reject) => {
        https.get(url, (resp) => {
          if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
            return fetchRedirect(resp.headers.location).then(resolve).catch(reject);
          }
          let data = '';
          resp.on('data', chunk => data += chunk);
          resp.on('end', () => resolve(data));
        }).on('error', reject);
      });
    }

    // Check if cache exists and is fresh (< 30 minutes old)
    if (fs.existsSync(ACTIVE_SUBS_CACHE_FILE)) {
      const stats = fs.statSync(ACTIVE_SUBS_CACHE_FILE);
      const ageMinutes = (Date.now() - stats.mtimeMs) / (1000 * 60);
      if (ageMinutes < 30 && req.query.refresh !== 'true') {
        res.setHeader('Content-Type', 'text/csv');
        return fs.createReadStream(ACTIVE_SUBS_CACHE_FILE).pipe(res);
      }
    }

    try {
      const csvData = await fetchRedirect(ACTIVE_SUBS_METABASE_URL);
      if (csvData && csvData.length > 100) {
        fs.writeFileSync(ACTIVE_SUBS_CACHE_FILE, csvData, 'utf8');
        res.setHeader('Content-Type', 'text/csv');
        return res.send(csvData);
      }
    } catch (fetchErr) {
      console.warn('⚠️ Could not fetch live Metabase active subs CSV, using local cache:', fetchErr.message);
    }

    if (fs.existsSync(ACTIVE_SUBS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(ACTIVE_SUBS_CACHE_FILE).pipe(res);
    }

    res.status(500).send('Active subscriptions data unavailable');
  } catch (err) {
    if (fs.existsSync(ACTIVE_SUBS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(ACTIVE_SUBS_CACHE_FILE).pipe(res);
    }
    res.status(500).send(err.message);
  }
});

/* ---------- New Users Delivery Status CSV Endpoint ---------- */
const NEW_USERS_DELIVERY_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/46622b98-120c-473a-881b-d2aebe879fce.csv';
const NEW_USERS_DELIVERY_DETAILS_CACHE_FILE = path.join(__dirname, '..', 'data', 'new_users_delivery_status_details.csv');

app.get('/api/new-users-delivery-status-csv', async (req, res) => {
  try {
    const https = require('https');
    function fetchRedirect(url) {
      return new Promise((resolve, reject) => {
        https.get(url, (resp) => {
          if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
            return fetchRedirect(resp.headers.location).then(resolve).catch(reject);
          }
          let data = '';
          resp.on('data', chunk => data += chunk);
          resp.on('end', () => resolve(data));
        }).on('error', reject);
      });
    }

    // Check if cache exists and is fresh (< 30 minutes old)
    if (fs.existsSync(NEW_USERS_DELIVERY_DETAILS_CACHE_FILE)) {
      const stats = fs.statSync(NEW_USERS_DELIVERY_DETAILS_CACHE_FILE);
      const ageMinutes = (Date.now() - stats.mtimeMs) / (1000 * 60);
      if (ageMinutes < 30 && req.query.refresh !== 'true') {
        res.setHeader('Content-Type', 'text/csv');
        return fs.createReadStream(NEW_USERS_DELIVERY_DETAILS_CACHE_FILE).pipe(res);
      }
    }

    try {
      const csvData = await fetchRedirect(NEW_USERS_DELIVERY_DETAILS_URL);
      if (csvData && csvData.length > 50) {
        fs.writeFileSync(NEW_USERS_DELIVERY_DETAILS_CACHE_FILE, csvData, 'utf8');
        res.setHeader('Content-Type', 'text/csv');
        return res.send(csvData);
      }
    } catch (fetchErr) {
      console.warn('⚠️ Could not fetch live Metabase new users delivery details CSV, using local cache:', fetchErr.message);
    }

    if (fs.existsSync(NEW_USERS_DELIVERY_DETAILS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(NEW_USERS_DELIVERY_DETAILS_CACHE_FILE).pipe(res);
    }

    res.status(500).send('New users delivery status details data unavailable');
  } catch (err) {
    if (fs.existsSync(NEW_USERS_DELIVERY_DETAILS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(NEW_USERS_DELIVERY_DETAILS_CACHE_FILE).pipe(res);
    }
    res.status(500).send(err.message);
  }
});

/* ---------- User Order and Delivery Status of All New Users CSV Endpoint ---------- */
const ALL_NEW_USERS_ORDER_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/e142aa5b-7f4f-433a-8540-28baec11c706.csv';
const ALL_NEW_USERS_ORDER_DETAILS_CACHE_FILE = path.join(__dirname, '..', 'data', 'all_new_users_order_status_details.csv');

app.get('/api/all-new-users-order-status-csv', async (req, res) => {
  try {
    const https = require('https');
    function fetchRedirect(url) {
      return new Promise((resolve, reject) => {
        https.get(url, (resp) => {
          if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
            return fetchRedirect(resp.headers.location).then(resolve).catch(reject);
          }
          let data = '';
          resp.on('data', chunk => data += chunk);
          resp.on('end', () => resolve(data));
        }).on('error', reject);
      });
    }

    // Check if cache exists and is fresh (< 30 minutes old)
    if (fs.existsSync(ALL_NEW_USERS_ORDER_DETAILS_CACHE_FILE)) {
      const stats = fs.statSync(ALL_NEW_USERS_ORDER_DETAILS_CACHE_FILE);
      const ageMinutes = (Date.now() - stats.mtimeMs) / (1000 * 60);
      if (ageMinutes < 30 && req.query.refresh !== 'true') {
        res.setHeader('Content-Type', 'text/csv');
        return fs.createReadStream(ALL_NEW_USERS_ORDER_DETAILS_CACHE_FILE).pipe(res);
      }
    }

    try {
      const csvData = await fetchRedirect(ALL_NEW_USERS_ORDER_DETAILS_URL);
      if (csvData && csvData.length > 50 && !csvData.includes('HTTP ERROR 500')) {
        fs.writeFileSync(ALL_NEW_USERS_ORDER_DETAILS_CACHE_FILE, csvData, 'utf8');
        res.setHeader('Content-Type', 'text/csv');
        return res.send(csvData);
      }
    } catch (fetchErr) {
      console.warn('⚠️ Could not fetch live Metabase all new users order details CSV, using local cache:', fetchErr.message);
    }

    if (fs.existsSync(ALL_NEW_USERS_ORDER_DETAILS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(ALL_NEW_USERS_ORDER_DETAILS_CACHE_FILE).pipe(res);
    }

    res.status(500).send('All new users order status details data unavailable');
  } catch (err) {
    if (fs.existsSync(ALL_NEW_USERS_ORDER_DETAILS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(ALL_NEW_USERS_ORDER_DETAILS_CACHE_FILE).pipe(res);
    }
    res.status(500).send(err.message);
  }
});

/* ---------- New Users & App Downloads Details CSV Endpoint ---------- */
const APP_DOWNLOADS_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/e964576c-8d8c-4944-b859-57b166a13a1b.csv';
const APP_DOWNLOADS_DETAILS_CACHE_FILE = path.join(__dirname, '..', 'data', 'app_downloads_details.csv');

app.get('/api/app-downloads-details-csv', async (req, res) => {
  try {
    const https = require('https');
    function fetchRedirect(url) {
      return new Promise((resolve, reject) => {
        https.get(url, (resp) => {
          if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
            return fetchRedirect(resp.headers.location).then(resolve).catch(reject);
          }
          let data = '';
          resp.on('data', chunk => data += chunk);
          resp.on('end', () => resolve(data));
        }).on('error', reject);
      });
    }

    // Check if cache exists and is fresh (< 30 minutes old)
    if (fs.existsSync(APP_DOWNLOADS_DETAILS_CACHE_FILE)) {
      const stats = fs.statSync(APP_DOWNLOADS_DETAILS_CACHE_FILE);
      const ageMinutes = (Date.now() - stats.mtimeMs) / (1000 * 60);
      if (ageMinutes < 30 && req.query.refresh !== 'true') {
        res.setHeader('Content-Type', 'text/csv');
        return fs.createReadStream(APP_DOWNLOADS_DETAILS_CACHE_FILE).pipe(res);
      }
    }

    try {
      const csvData = await fetchRedirect(APP_DOWNLOADS_DETAILS_URL);
      if (csvData && csvData.length > 50 && !csvData.includes('HTTP ERROR 500')) {
        fs.writeFileSync(APP_DOWNLOADS_DETAILS_CACHE_FILE, csvData, 'utf8');
        res.setHeader('Content-Type', 'text/csv');
        return res.send(csvData);
      }
    } catch (fetchErr) {
      console.warn('⚠️ Could not fetch live Metabase app downloads details CSV, using local cache:', fetchErr.message);
    }

    if (fs.existsSync(APP_DOWNLOADS_DETAILS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(APP_DOWNLOADS_DETAILS_CACHE_FILE).pipe(res);
    }

    res.status(500).send('App downloads details data unavailable');
  } catch (err) {
    if (fs.existsSync(APP_DOWNLOADS_DETAILS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(APP_DOWNLOADS_DETAILS_CACHE_FILE).pipe(res);
    }
    res.status(500).send(err.message);
  }
});

/* ---------- TeleCRM Leads Details CSV Endpoint ---------- */
const TELECRM_LEADS_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/b3f36132-e371-4fa0-a186-1302ceaa8a80.csv';
const TELECRM_LEADS_DETAILS_CACHE_FILE = path.join(__dirname, '..', 'data', 'telecrm_leads_details.csv');

app.get('/api/telecrm-leads-details-csv', async (req, res) => {
  try {
    const https = require('https');
    function fetchRedirect(url) {
      return new Promise((resolve, reject) => {
        https.get(url, (resp) => {
          if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
            return fetchRedirect(resp.headers.location).then(resolve).catch(reject);
          }
          let data = '';
          resp.on('data', chunk => data += chunk);
          resp.on('end', () => resolve(data));
        }).on('error', reject);
      });
    }

    // Check if cache exists and is fresh (< 30 minutes old)
    if (fs.existsSync(TELECRM_LEADS_DETAILS_CACHE_FILE)) {
      const stats = fs.statSync(TELECRM_LEADS_DETAILS_CACHE_FILE);
      const ageMinutes = (Date.now() - stats.mtimeMs) / (1000 * 60);
      if (ageMinutes < 30 && req.query.refresh !== 'true') {
        res.setHeader('Content-Type', 'text/csv');
        return fs.createReadStream(TELECRM_LEADS_DETAILS_CACHE_FILE).pipe(res);
      }
    }

    try {
      const csvData = await fetchRedirect(TELECRM_LEADS_DETAILS_URL);
      if (csvData && csvData.length > 50 && !csvData.includes('HTTP ERROR 500')) {
        fs.writeFileSync(TELECRM_LEADS_DETAILS_CACHE_FILE, csvData, 'utf8');
        res.setHeader('Content-Type', 'text/csv');
        return res.send(csvData);
      }
    } catch (fetchErr) {
      console.warn('⚠️ Could not fetch live Metabase TeleCRM leads details CSV, using local cache:', fetchErr.message);
    }

    if (fs.existsSync(TELECRM_LEADS_DETAILS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(TELECRM_LEADS_DETAILS_CACHE_FILE).pipe(res);
    }

    res.status(500).send('TeleCRM leads details data unavailable');
  } catch (err) {
    if (fs.existsSync(TELECRM_LEADS_DETAILS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(TELECRM_LEADS_DETAILS_CACHE_FILE).pipe(res);
    }
    res.status(500).send(err.message);
  }
});

/* ---------- Subscriptions Ending in Next 5 Days Details CSV Endpoint ---------- */
const SUBS_ENDING_5D_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/68f1530b-d09c-446e-b380-5da408fecf2a.csv';
const SUBS_ENDING_5D_DETAILS_CACHE_FILE = path.join(__dirname, '..', 'data', 'subs_ending_5d_details.csv');

app.get('/api/subs-ending-5d-details-csv', async (req, res) => {
  try {
    const https = require('https');
    function fetchRedirect(url) {
      return new Promise((resolve, reject) => {
        https.get(url, (resp) => {
          if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
            return fetchRedirect(resp.headers.location).then(resolve).catch(reject);
          }
          let data = '';
          resp.on('data', chunk => data += chunk);
          resp.on('end', () => resolve(data));
        }).on('error', reject);
      });
    }

    // Check if cache exists and is fresh (< 30 minutes old)
    if (fs.existsSync(SUBS_ENDING_5D_DETAILS_CACHE_FILE)) {
      const stats = fs.statSync(SUBS_ENDING_5D_DETAILS_CACHE_FILE);
      const ageMinutes = (Date.now() - stats.mtimeMs) / (1000 * 60);
      if (ageMinutes < 30 && req.query.refresh !== 'true') {
        res.setHeader('Content-Type', 'text/csv');
        return fs.createReadStream(SUBS_ENDING_5D_DETAILS_CACHE_FILE).pipe(res);
      }
    }

    try {
      const csvData = await fetchRedirect(SUBS_ENDING_5D_DETAILS_URL);
      if (csvData && csvData.length > 50 && !csvData.includes('HTTP ERROR 500')) {
        fs.writeFileSync(SUBS_ENDING_5D_DETAILS_CACHE_FILE, csvData, 'utf8');
        res.setHeader('Content-Type', 'text/csv');
        return res.send(csvData);
      }
    } catch (fetchErr) {
      console.warn('⚠️ Could not fetch live Metabase Subscriptions Ending 5d details CSV, using local cache:', fetchErr.message);
    }

    if (fs.existsSync(SUBS_ENDING_5D_DETAILS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(SUBS_ENDING_5D_DETAILS_CACHE_FILE).pipe(res);
    }

    res.status(500).send('Subscriptions ending in next 5 days details data unavailable');
  } catch (err) {
    if (fs.existsSync(SUBS_ENDING_5D_DETAILS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(SUBS_ENDING_5D_DETAILS_CACHE_FILE).pipe(res);
    }
    res.status(500).send(err.message);
  }
});

/* ---------- Subscriptions Expired / Cancelled in Last 7 Days Details CSV Endpoint ---------- */
const SUBS_EXPIRED_7D_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/f2674048-51bb-43bf-beee-c6983651c727.csv';
const SUBS_EXPIRED_7D_DETAILS_CACHE_FILE = path.join(__dirname, '..', 'data', 'subs_expired_7d_details.csv');

app.get('/api/subs-expired-7d-details-csv', async (req, res) => {
  try {
    const https = require('https');
    function fetchRedirect(url) {
      return new Promise((resolve, reject) => {
        https.get(url, (resp) => {
          if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
            return fetchRedirect(resp.headers.location).then(resolve).catch(reject);
          }
          let data = '';
          resp.on('data', chunk => data += chunk);
          resp.on('end', () => resolve(data));
        }).on('error', reject);
      });
    }

    // Check if cache exists and is fresh (< 30 minutes old)
    if (fs.existsSync(SUBS_EXPIRED_7D_DETAILS_CACHE_FILE)) {
      const stats = fs.statSync(SUBS_EXPIRED_7D_DETAILS_CACHE_FILE);
      const ageMinutes = (Date.now() - stats.mtimeMs) / (1000 * 60);
      if (ageMinutes < 30 && req.query.refresh !== 'true') {
        res.setHeader('Content-Type', 'text/csv');
        return fs.createReadStream(SUBS_EXPIRED_7D_DETAILS_CACHE_FILE).pipe(res);
      }
    }

    try {
      const csvData = await fetchRedirect(SUBS_EXPIRED_7D_DETAILS_URL);
      if (csvData && csvData.length > 50 && !csvData.includes('HTTP ERROR 500')) {
        fs.writeFileSync(SUBS_EXPIRED_7D_DETAILS_CACHE_FILE, csvData, 'utf8');
        res.setHeader('Content-Type', 'text/csv');
        return res.send(csvData);
      }
    } catch (fetchErr) {
      console.warn('⚠️ Could not fetch live Metabase Subscriptions Expired 7d details CSV, using local cache:', fetchErr.message);
    }

    if (fs.existsSync(SUBS_EXPIRED_7D_DETAILS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(SUBS_EXPIRED_7D_DETAILS_CACHE_FILE).pipe(res);
    }

    res.status(500).send('Subscriptions expired / cancelled in last 7 days details data unavailable');
  } catch (err) {
    if (fs.existsSync(SUBS_EXPIRED_7D_DETAILS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(SUBS_EXPIRED_7D_DETAILS_CACHE_FILE).pipe(res);
    }
    res.status(500).send(err.message);
  }
});

/* ---------- Subscriptions Expiring Today Details CSV Endpoint ---------- */
const SUBS_EXPIRING_TODAY_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/b7e9d453-fd39-4d31-81ce-330f4f5277cb.csv';
const SUBS_EXPIRING_TODAY_DETAILS_CACHE_FILE = path.join(__dirname, '..', 'data', 'subs_expiring_today_details.csv');

app.get('/api/subs-expiring-today-details-csv', async (req, res) => {
  try {
    const https = require('https');
    function fetchRedirect(url) {
      return new Promise((resolve, reject) => {
        https.get(url, (resp) => {
          if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
            return fetchRedirect(resp.headers.location).then(resolve).catch(reject);
          }
          let data = '';
          resp.on('data', chunk => data += chunk);
          resp.on('end', () => resolve(data));
        }).on('error', reject);
      });
    }

    // Check if cache exists and is fresh (< 30 minutes old)
    if (fs.existsSync(SUBS_EXPIRING_TODAY_DETAILS_CACHE_FILE)) {
      const stats = fs.statSync(SUBS_EXPIRING_TODAY_DETAILS_CACHE_FILE);
      const ageMinutes = (Date.now() - stats.mtimeMs) / (1000 * 60);
      if (ageMinutes < 30 && req.query.refresh !== 'true') {
        res.setHeader('Content-Type', 'text/csv');
        return fs.createReadStream(SUBS_EXPIRING_TODAY_DETAILS_CACHE_FILE).pipe(res);
      }
    }

    try {
      const csvData = await fetchRedirect(SUBS_EXPIRING_TODAY_DETAILS_URL);
      if (csvData && csvData.length > 50 && !csvData.includes('HTTP ERROR 500')) {
        fs.writeFileSync(SUBS_EXPIRING_TODAY_DETAILS_CACHE_FILE, csvData, 'utf8');
        res.setHeader('Content-Type', 'text/csv');
        return res.send(csvData);
      }
    } catch (fetchErr) {
      console.warn('⚠️ Could not fetch live Metabase Subscriptions Expiring Today details CSV, using local cache:', fetchErr.message);
    }

    if (fs.existsSync(SUBS_EXPIRING_TODAY_DETAILS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(SUBS_EXPIRING_TODAY_DETAILS_CACHE_FILE).pipe(res);
    }

    res.status(500).send('Subscriptions expiring today details data unavailable');
  } catch (err) {
    if (fs.existsSync(SUBS_EXPIRING_TODAY_DETAILS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(SUBS_EXPIRING_TODAY_DETAILS_CACHE_FILE).pipe(res);
    }
    res.status(500).send(err.message);
  }
});

/* ---------- Plan Expired and Not a Single Order Placed Details CSV Endpoint ---------- */
const PLAN_EXP_NO_ORDER_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/debcc18f-227d-42ba-93ac-ce47f87e3b7c.csv';
const PLAN_EXP_NO_ORDER_DETAILS_CACHE_FILE = path.join(__dirname, '..', 'data', 'plan_exp_no_order_details.csv');

app.get('/api/plan-exp-no-order-details-csv', async (req, res) => {
  try {
    const https = require('https');
    function fetchRedirect(url) {
      return new Promise((resolve, reject) => {
        https.get(url, (resp) => {
          if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
            return fetchRedirect(resp.headers.location).then(resolve).catch(reject);
          }
          let data = '';
          resp.on('data', chunk => data += chunk);
          resp.on('end', () => resolve(data));
        }).on('error', reject);
      });
    }

    // Check if cache exists and is fresh (< 30 minutes old)
    if (fs.existsSync(PLAN_EXP_NO_ORDER_DETAILS_CACHE_FILE)) {
      const stats = fs.statSync(PLAN_EXP_NO_ORDER_DETAILS_CACHE_FILE);
      const ageMinutes = (Date.now() - stats.mtimeMs) / (1000 * 60);
      if (ageMinutes < 30 && req.query.refresh !== 'true') {
        res.setHeader('Content-Type', 'text/csv');
        return fs.createReadStream(PLAN_EXP_NO_ORDER_DETAILS_CACHE_FILE).pipe(res);
      }
    }

    try {
      const csvData = await fetchRedirect(PLAN_EXP_NO_ORDER_DETAILS_URL);
      if (csvData && csvData.length > 50 && !csvData.includes('HTTP ERROR 500')) {
        fs.writeFileSync(PLAN_EXP_NO_ORDER_DETAILS_CACHE_FILE, csvData, 'utf8');
        res.setHeader('Content-Type', 'text/csv');
        return res.send(csvData);
      }
    } catch (fetchErr) {
      console.warn('⚠️ Could not fetch live Metabase Plan Expired No Order details CSV, using local cache:', fetchErr.message);
    }

    if (fs.existsSync(PLAN_EXP_NO_ORDER_DETAILS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(PLAN_EXP_NO_ORDER_DETAILS_CACHE_FILE).pipe(res);
    }

    res.status(500).send('Plan expired no order details data unavailable');
  } catch (err) {
    if (fs.existsSync(PLAN_EXP_NO_ORDER_DETAILS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(PLAN_EXP_NO_ORDER_DETAILS_CACHE_FILE).pipe(res);
    }
    res.status(500).send(err.message);
  }
});

/* ---------- Plan Expiring and Not Placed a Single Order Details CSV Endpoint ---------- */
const PLAN_EXPIRING_NO_ORDER_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/cec33372-48dd-44bf-8832-99b757075679.csv';
const PLAN_EXPIRING_NO_ORDER_DETAILS_CACHE_FILE = path.join(__dirname, '..', 'data', 'plan_expiring_no_order_details.csv');

app.get('/api/plan-expiring-no-order-details-csv', async (req, res) => {
  try {
    const https = require('https');
    function fetchRedirect(url) {
      return new Promise((resolve, reject) => {
        https.get(url, (resp) => {
          if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
            return fetchRedirect(resp.headers.location).then(resolve).catch(reject);
          }
          let data = '';
          resp.on('data', chunk => data += chunk);
          resp.on('end', () => resolve(data));
        }).on('error', reject);
      });
    }

    // Check if cache exists and is fresh (< 30 minutes old)
    if (fs.existsSync(PLAN_EXPIRING_NO_ORDER_DETAILS_CACHE_FILE)) {
      const stats = fs.statSync(PLAN_EXPIRING_NO_ORDER_DETAILS_CACHE_FILE);
      const ageMinutes = (Date.now() - stats.mtimeMs) / (1000 * 60);
      if (ageMinutes < 30 && req.query.refresh !== 'true') {
        res.setHeader('Content-Type', 'text/csv');
        return fs.createReadStream(PLAN_EXPIRING_NO_ORDER_DETAILS_CACHE_FILE).pipe(res);
      }
    }

    try {
      const csvData = await fetchRedirect(PLAN_EXPIRING_NO_ORDER_DETAILS_URL);
      if (csvData && !csvData.includes('HTTP ERROR 500')) {
        fs.writeFileSync(PLAN_EXPIRING_NO_ORDER_DETAILS_CACHE_FILE, csvData, 'utf8');
        res.setHeader('Content-Type', 'text/csv');
        return res.send(csvData);
      }
    } catch (fetchErr) {
      console.warn('⚠️ Could not fetch live Metabase Plan Expiring No Order details CSV, using local cache:', fetchErr.message);
    }

    if (fs.existsSync(PLAN_EXPIRING_NO_ORDER_DETAILS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(PLAN_EXPIRING_NO_ORDER_DETAILS_CACHE_FILE).pipe(res);
    }

    res.status(500).send('Plan expiring no order details data unavailable');
  } catch (err) {
    if (fs.existsSync(PLAN_EXPIRING_NO_ORDER_DETAILS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(PLAN_EXPIRING_NO_ORDER_DETAILS_CACHE_FILE).pipe(res);
    }
    res.status(500).send(err.message);
  }
});

/* ---------- Active Subscriber & No Orders Placed Yet Details CSV Endpoint ---------- */
const ACTIVE_SUB_NO_ORDERS_DETAILS_URL = 'https://metabase-bkp.theelefant.ai/public/question/d94cc795-d77d-477e-b61d-f96da7c2c6a7.csv';
const ACTIVE_SUB_NO_ORDERS_DETAILS_CACHE_FILE = path.join(__dirname, '..', 'data', 'active_sub_no_orders_details.csv');

app.get('/api/active-sub-no-orders-details-csv', async (req, res) => {
  try {
    const https = require('https');
    function fetchRedirect(url) {
      return new Promise((resolve, reject) => {
        https.get(url, (resp) => {
          if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
            return fetchRedirect(resp.headers.location).then(resolve).catch(reject);
          }
          let data = '';
          resp.on('data', chunk => data += chunk);
          resp.on('end', () => resolve(data));
        }).on('error', reject);
      });
    }

    // Check if cache exists and is fresh (< 30 minutes old)
    if (fs.existsSync(ACTIVE_SUB_NO_ORDERS_DETAILS_CACHE_FILE)) {
      const stats = fs.statSync(ACTIVE_SUB_NO_ORDERS_DETAILS_CACHE_FILE);
      const ageMinutes = (Date.now() - stats.mtimeMs) / (1000 * 60);
      if (ageMinutes < 30 && req.query.refresh !== 'true') {
        res.setHeader('Content-Type', 'text/csv');
        return fs.createReadStream(ACTIVE_SUB_NO_ORDERS_DETAILS_CACHE_FILE).pipe(res);
      }
    }

    try {
      const csvData = await fetchRedirect(ACTIVE_SUB_NO_ORDERS_DETAILS_URL);
      if (csvData && csvData.length > 50 && !csvData.includes('HTTP ERROR 500')) {
        fs.writeFileSync(ACTIVE_SUB_NO_ORDERS_DETAILS_CACHE_FILE, csvData, 'utf8');
        res.setHeader('Content-Type', 'text/csv');
        return res.send(csvData);
      }
    } catch (fetchErr) {
      console.warn('⚠️ Could not fetch live Metabase Active Sub No Orders details CSV, using local cache:', fetchErr.message);
    }

    if (fs.existsSync(ACTIVE_SUB_NO_ORDERS_DETAILS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(ACTIVE_SUB_NO_ORDERS_DETAILS_CACHE_FILE).pipe(res);
    }

    res.status(500).send('Active subscriber no orders details data unavailable');
  } catch (err) {
    if (fs.existsSync(ACTIVE_SUB_NO_ORDERS_DETAILS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(ACTIVE_SUB_NO_ORDERS_DETAILS_CACHE_FILE).pipe(res);
    }
    res.status(500).send(err.message);
  }
});

/* ---------- Processed Refunds Details CSV Endpoint ---------- */
const REFUNDS_SPREADSHEET_ID = '1Q_IX-4CJK8_xr_7qicmhRQMOjIlLxHe0MBCS9bT-xnE';
const REFUNDS_SHEET_NAME = 'Refunds';
const REFUNDS_CACHE_FILE = path.join(__dirname, '..', 'data', 'refunds.csv');
const REFUNDS_URL = `https://docs.google.com/spreadsheets/d/${REFUNDS_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(REFUNDS_SHEET_NAME)}`;

app.get('/api/refunds-csv', async (req, res) => {
  try {
    const https = require('https');
    function fetchRedirect(url) {
      return new Promise((resolve, reject) => {
        https.get(url, (resp) => {
          if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
            return fetchRedirect(resp.headers.location).then(resolve).catch(reject);
          }
          let data = '';
          resp.on('data', chunk => data += chunk);
          resp.on('end', () => resolve(data));
        }).on('error', reject);
      });
    }

    // Check if cache exists and is fresh (< 30 minutes old)
    if (fs.existsSync(REFUNDS_CACHE_FILE)) {
      const stats = fs.statSync(REFUNDS_CACHE_FILE);
      const ageMinutes = (Date.now() - stats.mtimeMs) / (1000 * 60);
      if (ageMinutes < 30 && req.query.refresh !== 'true') {
        res.setHeader('Content-Type', 'text/csv');
        return fs.createReadStream(REFUNDS_CACHE_FILE).pipe(res);
      }
    }

    try {
      const csvData = await fetchRedirect(REFUNDS_URL);
      if (csvData && csvData.length > 50 && !csvData.includes('HTTP ERROR 500')) {
        fs.writeFileSync(REFUNDS_CACHE_FILE, csvData, 'utf8');
        res.setHeader('Content-Type', 'text/csv');
        return res.send(csvData);
      }
    } catch (fetchErr) {
      console.warn('⚠️ Could not fetch live Google Sheet Refunds CSV, using local cache:', fetchErr.message);
    }

    if (fs.existsSync(REFUNDS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(REFUNDS_CACHE_FILE).pipe(res);
    }

    res.status(500).send('Refunds data unavailable');
  } catch (err) {
    if (fs.existsSync(REFUNDS_CACHE_FILE)) {
      res.setHeader('Content-Type', 'text/csv');
      return fs.createReadStream(REFUNDS_CACHE_FILE).pipe(res);
    }
    res.status(500).send(err.message);
  }
});

/* ---------- Trigger Daily Report Endpoint (Sync + Email Send) ---------- */
const handleTriggerDailyReport = async (req, res) => {
  try {
    if (process.env.DISABLE_EMAIL === 'true') {
      console.log('⏸️ [PAUSED] Email sending is currently disabled (DISABLE_EMAIL=true). No email sent.');
      return res.json({ success: true, paused: true, message: 'Email sending is paused until you re-enable it.' });
    }

    console.log(`🚀 Trigger received — fetching latest live data & sending daily sales report...`);
    
    let allData;
    try {
      const { syncSalesData } = require('../scripts/sync_sheets');
      allData = await syncSalesData();
      console.log(`📡 Successfully synced ${allData.length} days of data before email trigger.`);
    } catch (syncErr) {
      console.warn('⚠️ Could not sync live data, using existing data.json:', syncErr.message);
      allData = getAllReportData();
    }

    if (!allData || allData.length === 0) {
      return res.status(500).json({ error: 'No data available to send report.' });
    }

    const today = allData[allData.length - 1];
    const d = new Date(today.date + 'T00:00:00');
    const dateStr = d.toLocaleDateString('en-IN', {
      month: 'short', day: 'numeric', year: 'numeric',
    });

    const html = buildEmailHTMLServer(allData);
    const recipients = getRecipients();
    const toList = recipients.map(r => `"${r.name}" <${r.email}>`).join(', ');

    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to: toList,
      subject: `📈 Daily Sales Report — ${dateStr} [${fmtINR(today.totalRevenue)}]`,
      html,
    });

    console.log(`✅ Daily Sales Report sent — Message ID: ${info.messageId}`);
    res.json({ success: true, messageId: info.messageId, recipientCount: recipients.length, date: dateStr });
  } catch (err) {
    console.error('❌ Trigger email error:', err);
    res.status(500).json({ error: err.message });
  }
};

app.post('/api/trigger-daily-report', handleTriggerDailyReport);
app.get('/api/trigger-daily-report', handleTriggerDailyReport);

/* ---------- Cron Job: Auto-send daily at 10:00 AM IST ---------- */
function parseCronExpression(raw) {
  if (!raw || typeof raw !== 'string') return '0 10 * * *';
  const clean = raw.trim().replace(/^["']|["']$/g, '');
  const parts = clean.split(/\s+/);
  if (parts.length === 5) {
    return clean;
  }
  console.warn(`⚠️ Invalid CRON_SCHEDULE ("${raw}"). Falling back to default "0 10 * * *".`);
  return '0 10 * * *';
}

const CRON_SCHEDULE = parseCronExpression(process.env.CRON_SCHEDULE);

if (require.main === module) {
  try {
    cron.schedule(CRON_SCHEDULE, async () => {
      if (process.env.DISABLE_EMAIL === 'true') {
        console.log('⏸️ [PAUSED] Automated 10:00 AM email is currently disabled (DISABLE_EMAIL=true). Skipping email send.');
        return;
      }

      console.log(`⏰ Cron triggered at ${new Date().toISOString()} — fetching latest data & sending daily sales report...`);

      try {
        // 1. Always sync latest live Google Sheets & Metabase data first
        let allData;
        try {
          const { syncSalesData } = require('../scripts/sync_sheets');
          allData = await syncSalesData();
          console.log(`📡 Successfully synced ${allData.length} days of data before email trigger.`);
        } catch (syncErr) {
          console.warn('⚠️ Could not sync live data during cron, using existing data.json:', syncErr.message);
          allData = getAllReportData();
        }

        if (!allData || allData.length === 0) {
          console.error('❌ No data available to send report.');
          return;
        }

        const today = allData[allData.length - 1];
        const d = new Date(today.date + 'T00:00:00');
        const dateStr = d.toLocaleDateString('en-IN', {
          month: 'short', day: 'numeric', year: 'numeric',
        });

        const html = buildEmailHTMLServer(allData);
        const recipients = getRecipients();
        const toList = recipients.map(r => `"${r.name}" <${r.email}>`).join(', ');

        const info = await transporter.sendMail({
          from: SMTP_FROM,
          to: toList,
          subject: `📈 Daily Sales Report — ${dateStr} [${fmtINR(today.totalRevenue)}]`,
          html,
        });

        console.log(`✅ Automated 10:00 AM Sales Report sent — Message ID: ${info.messageId}`);
      } catch (err) {
        console.error('❌ Cron email error:', err);
      }
    }, { timezone: 'Asia/Kolkata' });

    console.log(`📅 Cron scheduled: "${CRON_SCHEDULE}" (10:00 AM IST daily)`);
  } catch (cronErr) {
    console.error('⚠️ Could not schedule cron job:', cronErr.message);
  }

  /* ---------- Auto-Sync Cron: Refresh data every 30 minutes in background process ---------- */
  try {
    cron.schedule('*/30 * * * *', () => {
      const ts = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
      console.log(`🔄 [${ts} IST] Auto-sync triggered in background process...`);
      const { fork } = require('child_process');
      const child = fork(path.join(__dirname, '..', 'scripts', 'sync_sheets.js'));
      child.on('exit', (code) => {
        const ts2 = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
        if (code === 0) {
          console.log(`✅ [${ts2} IST] Auto-sync complete — data.json refreshed.`);
        } else {
          console.warn(`⚠️ [${ts2} IST] Auto-sync background process exited with code ${code}`);
        }
      });
    }, { timezone: 'Asia/Kolkata' });

    console.log('🔄 Auto-sync scheduled: every 30 minutes (non-blocking background process)');
  } catch (autoSyncErr) {
    console.error('⚠️ Could not schedule auto-sync:', autoSyncErr.message);
  }

  /* ---------- Start Server ---------- */
  const server = app.listen(PORT, () => {
    console.log(`\n🚀 Daily Sales Report Server running at http://localhost:${PORT}\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n⚠️ Port ${PORT} is already in use by another running process.`);
      console.error(`To free port ${PORT} on Windows, run in PowerShell:`);
      console.error(`  Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force\n`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });
}

module.exports = app;
