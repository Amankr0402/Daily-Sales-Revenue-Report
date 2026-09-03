/**
 * ============================================================
 *  Daily Sales & Revenue Report Dashboard — Frontend Logic
 *  Renders real daily sales KPIs, Chart.js visualisations,
 *  agent leaderboards, and email HTML with QuickChart images.
 * ============================================================
 */

/* ---------- Configuration ---------- */
const CONFIG = {
  API_BASE: window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? window.location.origin
    : (window.location.origin || 'http://localhost:3000'),
  DATA_URL: '/data/data.json',
};

/* ---------- DOM References ---------- */
const $kpiGrid          = document.getElementById('kpi-grid');
const $headerDate       = document.getElementById('header-date');
const $dateSelect       = document.getElementById('date-select');
const $btnRefresh       = document.getElementById('btn-refresh');
const $btnSend          = document.getElementById('btn-send-report');
const $modalOverlay     = document.getElementById('modal-overlay');
const $modalPreview     = document.getElementById('modal-preview');
const $modalClose       = document.getElementById('modal-close');
const $modalCancel      = document.getElementById('modal-cancel');
const $modalConfirm     = document.getElementById('modal-confirm');
const $toastContainer    = document.getElementById('toast-container');
const $agentLeaderboard   = document.getElementById('agent-leaderboard');
const $userBreakdownGrid  = document.getElementById('user-breakdown-grid');

/* ---------- State ---------- */
let allData           = [];
let selectedDateIndex = -1;
let todayData         = {};
let yesterdayData     = {};

/* ============================================================
   DATA LOADING
   ============================================================ */
async function fetchData(syncLive = false) {
  try {
    if (syncLive) {
      showToast('Syncing live data from Google Sheets & Metabase…', 'info');
      try {
        await fetch(`${CONFIG.API_BASE}/api/sync-sheets`, { method: 'POST' });
      } catch (syncErr) {
        console.warn('Backend sync-sheets API not available, loading static data:', syncErr);
      }
    }

    const resp = await fetch(`${CONFIG.DATA_URL}?t=${Date.now()}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    allData = await resp.json();

    allData.sort((a, b) => a.date.localeCompare(b.date));

    if (allData.length === 0) {
      showToast('No sales records found in dataset.', 'info');
      return;
    }

    // Default to the latest date
    if (selectedDateIndex === -1 || selectedDateIndex >= allData.length) {
      selectedDateIndex = allData.length - 1;
    }

    selectDate(selectedDateIndex);
    renderDateSelector();

    if (syncLive) {
      showToast('Dashboard updated with latest Google Sheets & Metabase data!', 'success');
    }
  } catch (err) {
    console.error('Failed to load data:', err);
    showToast('Failed to load report data. Check console.', 'error');
  }
}

function selectDate(index) {
  selectedDateIndex = index;
  todayData     = allData[selectedDateIndex];
  yesterdayData = selectedDateIndex > 0 ? allData[selectedDateIndex - 1] : todayData;
  render();
}

function renderDateSelector() {
  if (!$dateSelect || allData.length === 0) return;

  $dateSelect.innerHTML = allData.map((d, idx) => {
    const isLatest = idx === allData.length - 1;
    const isYday   = idx === allData.length - 2;
    const dateObj  = new Date(d.date + 'T00:00:00');
    const formatted = dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    const tag = isLatest ? ' (Latest)' : isYday ? ' (Yesterday)' : '';
    const isSelected = idx === selectedDateIndex ? 'selected' : '';
    return `<option value="${idx}" ${isSelected}>${formatted}${tag}</option>`;
  }).reverse().join('');
}

/* ============================================================
   RENDERING
   ============================================================ */
function render() {
  renderHeader();
  renderKPIs();
  renderUserBreakdown();
  renderCharts();
  renderLeaderboard();
}

/* ---------- D-o-D User Breakdown ---------- */
function renderUserBreakdown() {
  if (!$userBreakdownGrid) return;
  const ub = todayData.userBreakdown;

  if (!ub) {
    $userBreakdownGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 16px; font-size: 0.82rem; font-weight: 500;">
        No conversion funnel metrics recorded for this date.
      </div>
    `;
    return;
  }

  const items = [
    { label: 'Signups', val: ub.signups.toLocaleString('en-IN'), sub: 'Total Signups', icon: '📝', color: '#818cf8' },
    { label: 'Serviceable', val: ub.serviceable.toLocaleString('en-IN'), sub: `${ub.serviceablePct} of signups`, icon: '📍', color: '#22d3ee' },
    { label: 'Toy Viewed', val: ub.toyViewed, sub: '% of Serviceable', icon: '🧸', color: '#34d399' },
    { label: 'Plan Page', val: ub.planPage, sub: '% of Serviceable', icon: '📋', color: '#60a5fa' },
    { label: 'Checkout Drop', val: ub.checkoutDrop, sub: '% of Serviceable', icon: '🛒', color: '#fbbf24' },
    { label: 'Payment Dropout', val: ub.paymentDropout, sub: '% of Serviceable', icon: '💳', color: '#fb7185' },
    { label: 'Won', val: ub.won, sub: '% of Serviceable', icon: '🏆', color: '#10b981' }
  ];

  $userBreakdownGrid.innerHTML = items.map(item => `
    <div class="user-breakdown-item">
      <div class="user-breakdown-item__icon">${item.icon}</div>
      <div class="user-breakdown-item__label">${item.label}</div>
      <div class="user-breakdown-item__val" style="color:${item.color}">${item.val}</div>
      <div class="user-breakdown-item__sub">${item.sub}</div>
    </div>
  `).join('');
}

/* ---------- Header Date ---------- */
function renderHeader() {
  const d = new Date(todayData.date + 'T00:00:00');
  const formatted = d.toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  $headerDate.textContent = formatted;
}

/* ---------- Currency Formatter ---------- */
function fmtINR(num) {
  return '₹' + Math.round(num).toLocaleString('en-IN');
}

/* ---------- KPI Cards ---------- */
function renderKPIs() {
  const todayRev     = todayData.totalRevenue || 0;
  const yesterdayRev = yesterdayData.totalRevenue || 0;
  const diffRev      = todayRev - yesterdayRev;

  const todayCount     = todayData.salesCount || 0;
  const yesterdayCount = yesterdayData.salesCount || 0;
  const diffCount      = todayCount - yesterdayCount;

  const todayAOV     = todayCount > 0 ? Math.round(todayRev / todayCount) : 0;
  const yesterdayAOV = yesterdayCount > 0 ? Math.round(yesterdayRev / yesterdayCount) : 0;
  const diffAOV      = todayAOV - yesterdayAOV;

  const organicCount = todayData.sources?.Organic?.count || 0;
  const renewalCount = todayData.sources?.Renewals?.count || 0;
  const eventsCount  = todayData.sources?.Events?.count || 0;

  // Find top agent
  let topAgentName = '—';
  let topAgentRev  = 0;
  if (todayData.agents) {
    const sortedAgents = Object.entries(todayData.agents).sort((a, b) => b[1].revenue - a[1].revenue);
    if (sortedAgents.length > 0) {
      topAgentName = sortedAgents[0][0];
      topAgentRev  = sortedAgents[0][1].revenue;
    }
  }

  const kpis = [
    {
      label: 'Total Revenue Today',
      value: fmtINR(todayRev),
      change: diffRev,
      isCurrency: true,
      icon: '💰',
      accent: 'emerald',
    },
    {
      label: 'Deals Closed Today',
      value: todayCount.toString(),
      change: diffCount,
      suffix: ' deals',
      icon: '🤝',
      accent: 'indigo',
    },
    {
      label: 'Average Deal Size (AOV)',
      value: fmtINR(todayAOV),
      change: diffAOV,
      isCurrency: true,
      icon: '📊',
      accent: 'cyan',
    },
    {
      label: 'Organic Deals',
      value: organicCount.toString(),
      change: organicCount - (yesterdayData.sources?.Organic?.count || 0),
      suffix: ' deals',
      icon: '🌱',
      accent: 'amber',
    },
    {
      label: 'Renewals / Upgrades',
      value: (renewalCount + (todayData.sources?.Upgrade?.count || 0)).toString(),
      change: (renewalCount + (todayData.sources?.Upgrade?.count || 0)) - ((yesterdayData.sources?.Renewals?.count || 0) + (yesterdayData.sources?.Upgrade?.count || 0)),
      suffix: ' deals',
      icon: '🔄',
      accent: 'violet',
    },
    {
      label: 'Top Agent Today',
      value: topAgentName.split(' ')[0], // First name for big display
      subValue: fmtINR(topAgentRev),
      icon: '👑',
      accent: 'rose',
      customTrend: `${topAgentName} (${fmtINR(topAgentRev)})`,
    },
  ];

  $kpiGrid.innerHTML = kpis.map((k, i) => {
    let trendHTML = '';
    if (k.customTrend) {
      trendHTML = `<span class="kpi-card__trend kpi-card__trend--up">${k.customTrend}</span>`;
    } else {
      const dir = k.change > 0 ? 'up' : k.change < 0 ? 'down' : 'neutral';
      const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '—';
      const sign = k.change > 0 ? '+' : '';
      const formattedDiff = k.isCurrency ? `${sign}${fmtINR(k.change)}` : `${sign}${k.change}${k.suffix || ''}`;
      trendHTML = `<span class="kpi-card__trend kpi-card__trend--${dir}">${arrow} ${formattedDiff} vs yesterday</span>`;
    }

    return `
      <div class="kpi-card fade-in" data-accent="${k.accent}" style="animation-delay:${i * 0.05}s">
        <div class="kpi-card__icon">${k.icon}</div>
        <p class="kpi-card__label">${k.label}</p>
        <p class="kpi-card__value">${k.value}</p>
        ${trendHTML}
      </div>`;
  }).join('');
}

/* ---------- Charts ---------- */
let chartRevenue, chartPlan, chartChannel;

function renderCharts() {
  [chartRevenue, chartPlan, chartChannel].forEach(c => c?.destroy());

  renderRevenueChart();
  renderPlanChart();
  renderChannelChart();
}

/* 1. Daily Revenue Trend */
function renderRevenueChart() {
  const labels = allData.map(d => formatShortDate(d.date));
  const data   = allData.map(d => d.totalRevenue);

  const ctx = document.getElementById('chart-revenue').getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 240);
  grad.addColorStop(0, 'rgba(99, 102, 241, 0.45)');
  grad.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

  chartRevenue = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Daily Revenue (₹)',
        data,
        borderColor: '#818cf8',
        backgroundColor: grad,
        borderWidth: 2.5,
        pointRadius: 3.5,
        pointBackgroundColor: '#818cf8',
        pointHoverRadius: 6,
        tension: 0.35,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipStyle(),
          callbacks: {
            label: (ctx) => ` Revenue: ${fmtINR(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: { ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } }, grid: { color: 'rgba(255,255,255,.04)' } },
        y: {
          beginAtZero: true,
          grace: '8%',
          ticks: {
            color: '#64748b',
            font: { family: 'Inter', size: 11 },
            callback: (v) => '₹' + (v / 1000) + 'k',
          },
          grid: { color: 'rgba(255,255,255,.04)' },
        },
      },
    },
  });
}

/* 2. Plan Distribution Donut */
function renderPlanChart() {
  const plans = todayData.plans || {};
  const labels = Object.keys(plans);
  const data = Object.values(plans).map(p => p.count);
  const totalPlanCount = data.reduce((a, b) => a + b, 0);
  const totalPlanRev = labels.reduce((sum, l) => sum + (plans[l]?.revenue || 0), 0);

  const colors = ['#818cf8', '#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#a78bfa', '#f43f5e'];

  // Center text plugin: displays total deals and revenue in center of donut
  const donutCenterPlugin = {
    id: 'donutCenterPlugin',
    beforeDraw: (chart) => {
      const { ctx, chartArea: { top, bottom, left, right } } = chart;
      if (!top) return;
      ctx.save();
      const centerX = (left + right) / 2;
      const centerY = (top + bottom) / 2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Total count
      ctx.font = '800 18px Inter, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${totalPlanCount} Deals`, centerX, centerY - 9);

      // Total revenue
      ctx.font = '700 12px Inter, sans-serif';
      ctx.fillStyle = '#34d399';
      ctx.fillText(fmtINR(totalPlanRev), centerX, centerY + 11);
      ctx.restore();
    }
  };

  // Slice label plugin: shows count & percentage on slices directly
  const donutSlicePlugin = {
    id: 'donutSlicePlugin',
    afterDatasetDraw: (chart, args) => {
      const { ctx } = chart;
      const meta = args.meta;
      meta.data.forEach((element, index) => {
        const count = chart.data.datasets[0].data[index];
        const pct = totalPlanCount > 0 ? Math.round((count / totalPlanCount) * 100) : 0;
        if (pct < 10) return; // Skip tiny slices to prevent text overlap

        const pos = element.tooltipPosition();
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(`${count} (${pct}%)`, pos.x, pos.y);
        ctx.restore();
      });
    }
  };

  chartPlan = new Chart(document.getElementById('chart-plan'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#0f172a',
        hoverOffset: 8,
      }],
    },
    plugins: [donutCenterPlugin, donutSlicePlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 11, weight: '500' },
            padding: 14,
            usePointStyle: true,
          }
        },
        tooltip: {
          ...tooltipStyle(),
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed} deals (${fmtINR(plans[ctx.label]?.revenue || 0)})`,
          },
        },
      },
    },
  });
}

/* 3. Acquisition Channels Bar */
function renderChannelChart() {
  const sources = todayData.sources || {};
  const labels = Object.keys(sources);
  const data = labels.map(s => sources[s].revenue);
  const counts = labels.map(s => sources[s].count);

  // Bar label plugin: permanently displays revenue and deal count above each bar
  const barValueLabelsPlugin = {
    id: 'barValueLabelsPlugin',
    afterDatasetDraw: (chart) => {
      const { ctx } = chart;
      chart.data.datasets.forEach((dataset, i) => {
        const meta = chart.getDatasetMeta(i);
        meta.data.forEach((bar, index) => {
          const rev = dataset.data[index];
          const count = counts[index];
          if (rev === undefined || rev === null) return;

          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';

          // Revenue label
          ctx.font = '700 11px Inter, sans-serif';
          ctx.fillStyle = '#34d399';
          ctx.fillText(fmtINR(rev), bar.x, bar.y - 15);

          // Deal count sub-label
          ctx.font = '600 10px Inter, sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(`${count} deal${count > 1 ? 's' : ''}`, bar.x, bar.y - 3);
          ctx.restore();
        });
      });
    }
  };

  chartChannel = new Chart(document.getElementById('chart-channel'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revenue by Source (₹)',
        data,
        backgroundColor: ['#34d399', '#818cf8', '#22d3ee', '#fbbf24'],
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: 56,
      }],
    },
    plugins: [barValueLabelsPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 24,
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipStyle(),
          callbacks: {
            label: (ctx) => ` Revenue: ${fmtINR(ctx.parsed.y)} (${counts[ctx.dataIndex]} deals)`,
          },
        },
      },
      scales: {
        x: { ticks: { color: '#cbd5e1', font: { family: 'Inter', size: 11, weight: '600' } }, grid: { display: false } },
        y: {
          beginAtZero: true,
          grace: '20%',
          ticks: {
            color: '#64748b',
            font: { family: 'Inter', size: 11 },
            callback: (v) => '₹' + (v / 1000) + 'k',
          },
          grid: { color: 'rgba(255,255,255,.04)' },
        },
      },
    },
  });
}

/* ---------- Agent Leaderboard ---------- */
function renderLeaderboard() {
  const agents = todayData.agents || {};
  const sorted = Object.entries(agents).sort((a, b) => b[1].revenue - a[1].revenue);

  if (sorted.length === 0) {
    $agentLeaderboard.innerHTML = '<p style="color:#64748b; padding: 12px 0;">No agent data recorded for today.</p>';
    return;
  }

  const [topAgentName, topAgentData] = sorted[0];
  const totalRev = todayData.totalRevenue || 1;
  const topAgentPct = ((topAgentData.revenue / totalRev) * 100).toFixed(1);
  const initials = topAgentName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const runnerUps = sorted.slice(1);

  let runnerUpsHTML = '';
  if (runnerUps.length > 0) {
    runnerUpsHTML = `
      <div class="leaderboard-section-header">
        <span class="leaderboard-section-title">Other Performing Sales Representatives</span>
        <span class="leaderboard-section-count">${runnerUps.length} Agents</span>
      </div>
      <div class="agent-leaderboard-grid">
        ${runnerUps.map(([agentName, data], idx) => {
          const rank = idx + 2;
          const rankClass = rank <= 3 ? `agent-rank--${rank}` : '';
          return `
            <div class="agent-item">
              <div class="agent-info">
                <div class="agent-rank ${rankClass}">#${rank}</div>
                <div>
                  <div class="agent-name">${agentName}</div>
                  <div class="agent-deals">${data.count} deal${data.count > 1 ? 's' : ''} closed</div>
                </div>
              </div>
              <div class="agent-revenue">${fmtINR(data.revenue)}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  $agentLeaderboard.innerHTML = `
    <!-- Top Performer Spotlight Card at Top of Section -->
    <div class="top-performer-hero">
      <div class="top-performer-hero__badge">
        <span>👑</span> Top Performer of the Day
      </div>
      <div class="top-performer-hero__main">
        <div class="top-performer-hero__profile">
          <div class="top-performer-hero__avatar">
            <span>${initials}</span>
            <div class="top-performer-hero__rank-badge" title="Top Performer">🏆</div>
          </div>
          <div class="top-performer-hero__details">
            <h3 class="top-performer-hero__name">${topAgentName}</h3>
            <div class="top-performer-hero__meta">
              <span class="top-performer-hero__pill">🎯 ${topAgentData.count} deal${topAgentData.count > 1 ? 's' : ''} closed</span>
              <span class="top-performer-hero__pill">📈 ${topAgentPct}% of today's revenue</span>
            </div>
          </div>
        </div>
        <div class="top-performer-hero__revenue-block">
          <span class="top-performer-hero__revenue-label">Total Revenue</span>
          <span class="top-performer-hero__revenue-val">${fmtINR(topAgentData.revenue)}</span>
        </div>
      </div>
    </div>

    ${runnerUpsHTML}
  `;
}

/* ---------- Helper Styles & Dates ---------- */
function tooltipStyle() {
  return {
    backgroundColor: '#1e293b',
    titleColor: '#f1f5f9',
    bodyColor: '#cbd5e1',
    borderColor: 'rgba(255,255,255,.1)',
    borderWidth: 1,
    cornerRadius: 8,
    padding: 12,
    titleFont: { family: 'Inter', weight: '600' },
    bodyFont:  { family: 'Inter' },
  };
}

function formatShortDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

/* ============================================================
   EMAIL REPORT GENERATION (WITH QUICKCHART VISUALS)
   ============================================================ */
function quickChartURL(config, width = 560, height = 280) {
  const json = JSON.stringify(config);
  return `https://quickchart.io/chart?c=${encodeURIComponent(json)}&w=${width}&h=${height}&bkg=white&f=png`;
}

function buildEmailHTML() {
  const d = new Date(todayData.date + 'T00:00:00');
  const dateStr = d.toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const todayRev     = todayData.totalRevenue || 0;
  const yesterdayRev = yesterdayData.totalRevenue || 0;
  const diffRev      = todayRev - yesterdayRev;
  const diffRevStr   = (diffRev >= 0 ? '+' : '') + fmtINR(diffRev);
  const diffColor    = diffRev >= 0 ? '#059669' : '#e11d48';

  const todayCount     = todayData.salesCount || 0;
  const yesterdayCount = yesterdayData.salesCount || 0;
  const diffCount      = todayCount - yesterdayCount;
  const diffCountStr   = (diffCount >= 0 ? '+' : '') + diffCount;
  const diffCountColor = diffCount >= 0 ? '#059669' : '#e11d48';

  const todayAOV     = todayCount > 0 ? Math.round(todayRev / todayCount) : 0;
  const yesterdayAOV = yesterdayCount > 0 ? Math.round(yesterdayRev / yesterdayCount) : 0;
  const diffAOV      = todayAOV - yesterdayAOV;
  const diffAOVStr   = (diffAOV >= 0 ? '+' : '') + fmtINR(diffAOV);
  const diffAOVColor = diffAOV >= 0 ? '#059669' : '#e11d48';

  const organicCount = todayData.sources?.Organic?.count || 0;
  const organicRev   = todayData.sources?.Organic?.revenue || 0;

  const renewalCount = (todayData.sources?.Renewals?.count || 0) + (todayData.sources?.Upgrade?.count || 0);
  const renewalRev   = (todayData.sources?.Renewals?.revenue || 0) + (todayData.sources?.Upgrade?.revenue || 0);

  // Sorted Agents
  const sortedAgents = Object.entries(todayData.agents || {}).sort((a, b) => b[1].revenue - a[1].revenue);
  const topAgent = sortedAgents.length > 0 ? sortedAgents[0] : ['—', { revenue: 0, count: 0 }];
  const topAgentInitials = topAgent[0].split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const topAgentPct = todayRev > 0 ? ((topAgent[1].revenue / todayRev) * 100).toFixed(1) : 0;

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
  const plans = todayData.plans || {};
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
  const sources = todayData.sources || {};
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
    ${todayData.userBreakdown ? `
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
            <td style="padding:9px 12px;text-align:center;font-weight:800;color:#4338ca;">${todayData.userBreakdown.signups.toLocaleString('en-IN')}</td>
            <td style="padding:9px 12px;text-align:right;color:#64748b;font-weight:600;">Total Registrations</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:9px 12px;font-weight:700;color:#1e293b;">📍 Serviceable</td>
            <td style="padding:9px 12px;text-align:center;font-weight:800;color:#0284c7;">${todayData.userBreakdown.serviceable.toLocaleString('en-IN')} <span style="font-size:11px;color:#0284c7;font-weight:600;">(${todayData.userBreakdown.serviceablePct})</span></td>
            <td style="padding:9px 12px;text-align:right;color:#64748b;font-weight:600;">% of Signups</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:9px 12px;font-weight:700;color:#1e293b;">🧸 Toy Viewed</td>
            <td style="padding:9px 12px;text-align:center;font-weight:800;color:#059669;">${todayData.userBreakdown.toyViewed}</td>
            <td style="padding:9px 12px;text-align:right;color:#64748b;font-weight:600;">% of Serviceable</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:9px 12px;font-weight:700;color:#1e293b;">📋 Plan Page</td>
            <td style="padding:9px 12px;text-align:center;font-weight:800;color:#2563eb;">${todayData.userBreakdown.planPage}</td>
            <td style="padding:9px 12px;text-align:right;color:#64748b;font-weight:600;">% of Serviceable</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:9px 12px;font-weight:700;color:#1e293b;">🛒 Checkout Drop</td>
            <td style="padding:9px 12px;text-align:center;font-weight:800;color:#d97706;">${todayData.userBreakdown.checkoutDrop}</td>
            <td style="padding:9px 12px;text-align:right;color:#64748b;font-weight:600;">% of Serviceable</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:9px 12px;font-weight:700;color:#1e293b;">💳 Payment Dropout</td>
            <td style="padding:9px 12px;text-align:center;font-weight:800;color:#e11d48;">${todayData.userBreakdown.paymentDropout}</td>
            <td style="padding:9px 12px;text-align:right;color:#64748b;font-weight:600;">% of Serviceable</td>
          </tr>
          <tr>
            <td style="padding:9px 12px;font-weight:700;color:#1e293b;">🏆 Won</td>
            <td style="padding:9px 12px;text-align:center;font-weight:900;color:#059669;background:#f0fdf4;">${todayData.userBreakdown.won}</td>
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

    <!-- ================= 5. TOP PERFORMING SALES AGENTS TODAY ================= -->
    <div style="padding:0 32px 28px;">
      <h2 style="margin:0 0 14px;font-size:16px;color:#0f172a;font-weight:800;">🏆 Top Performing Sales Agents Today</h2>
      
      ${sortedAgents.length > 0 ? `
      <!-- Top Performer Spotlight Card -->
      <div style="background:linear-gradient(135deg,#fef9c3 0%,#fef08a 50%,#fde047 100%);border:2px solid #f59e0b;border-radius:12px;padding:18px 22px;margin-bottom:16px;box-shadow:0 4px 14px rgba(245,158,11,0.18);">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="vertical-align:middle;">
              <div style="display:inline-block;background:#b45309;color:#ffffff;font-size:10px;font-weight:800;padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">
                👑 TOP PERFORMER OF THE DAY
              </div>
              <div style="display:flex;align-items:center;gap:12px;margin-top:4px;">
                <div style="width:44px;height:44px;background:#d97706;border-radius:50%;color:#ffffff;font-weight:800;font-size:16px;text-align:center;line-height:44px;border:2px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.15);position:relative;">
                  ${topAgentInitials}
                  <span style="position:absolute;bottom:-2px;right:-2px;background:#0f172a;border-radius:50%;font-size:11px;line-height:16px;width:16px;height:16px;display:block;border:1px solid #fbbf24;">🏆</span>
                </div>
                <div>
                  <h3 style="margin:0;font-size:19px;font-weight:900;color:#78350f;letter-spacing:-0.01em;">${topAgent[0]}</h3>
                  <div style="font-size:12px;color:#92400e;font-weight:600;margin-top:2px;">
                    🎯 ${topAgent[1].count} deal${topAgent[1].count > 1 ? 's' : ''} closed • 📈 ${topAgentPct}% of today's revenue
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

    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:20px 32px;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;line-height:1.5;">
      Automated Daily Sales Intelligence Report • Generated at 10:00 AM IST<br />
      Daily Sales &amp; Revenue Analytics Dashboard System
    </div>
  </div>`;
}

/* ============================================================
   MODAL & SEND FLOW
   ============================================================ */
function openModal() {
  $modalPreview.innerHTML = buildEmailHTML();
  $modalOverlay.classList.add('active');
}

function closeModal() {
  $modalOverlay.classList.remove('active');
}

async function sendReport() {
  closeModal();

  const html = buildEmailHTML();
  const d = new Date(todayData.date + 'T00:00:00');
  const dateStr = d.toLocaleDateString('en-IN', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  $btnSend.disabled = true;
  const originalHTML = $btnSend.innerHTML;
  $btnSend.innerHTML = '<span class="spinner"></span> Sending…';

  try {
    const resp = await fetch(`${CONFIG.API_BASE}/api/send-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: `📈 Daily Sales Report — ${dateStr} [${fmtINR(todayData.totalRevenue || 0)}]`,
        html,
        reportData: todayData,
      }),
    });

    const result = await resp.json();

    if (resp.ok) {
      showToast(`Report sent to ${result.recipientCount} recipient(s)!`, 'success');
    } else {
      throw new Error(result.error || 'Server error');
    }
  } catch (err) {
    console.error('Send failed:', err);
    showToast(`Send failed: ${err.message}`, 'error');
  } finally {
    $btnSend.disabled = false;
    $btnSend.innerHTML = originalHTML;
  }
}

/* ============================================================
   TOASTS & EVENTS
   ============================================================ */
function showToast(message, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
  $toastContainer.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 4500);
}

$dateSelect?.addEventListener('change', (e) => {
  selectDate(parseInt(e.target.value, 10));
});

$btnRefresh.addEventListener('click', () => fetchData(true));
$btnSend.addEventListener('click', openModal);
$modalClose.addEventListener('click', closeModal);
$modalCancel.addEventListener('click', closeModal);
$modalConfirm.addEventListener('click', sendReport);
$modalOverlay.addEventListener('click', (e) => { if (e.target === $modalOverlay) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

/* Init */
fetchData();
