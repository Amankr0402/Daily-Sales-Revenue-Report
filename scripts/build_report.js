/**
 * Build script — generates public/daily-report.html
 * Run: node scripts/build_report.js
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'daily-report.html');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Daily Sales Report \u2014 The Elefant</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"><\/script>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{
      --bg:#06091a;--surface:#0f1630;--surface2:#161d3a;
      --border:rgba(255,255,255,0.07);--text:#f1f5f9;--muted:#8896b3;
      --green:#10b981;--blue:#6366f1;--cyan:#06b6d4;
      --gold:#f59e0b;--red:#f43f5e;--purple:#8b5cf6;--orange:#fb923c;
      --radius:14px;
    }
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;padding:0 0 60px}
    /* HEADER */
    .rpt-header{background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4338ca 100%);padding:36px 40px 30px;border-bottom:1px solid rgba(99,102,241,0.3);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}
    .rpt-header h1{font-size:28px;font-weight:900;letter-spacing:-0.03em}
    .rpt-header h1 span{color:#a5b4fc}
    .header-meta{font-size:14px;color:rgba(255,255,255,0.7);margin-top:6px;font-weight:500}
    .header-right{display:flex;flex-direction:column;align-items:flex-end;gap:8px}
    .date-badge{background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:20px;padding:6px 16px;font-size:13px;font-weight:700}
    .print-btn{background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:10px;padding:10px 22px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:7px;box-shadow:0 4px 16px rgba(16,185,129,0.35);transition:transform .15s}
    .print-btn:hover{transform:translateY(-1px)}
    /* LAYOUT */
    .wrap{max-width:1200px;margin:0 auto;padding:32px 32px 0}
    .sec-title{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted);margin-bottom:14px;display:flex;align-items:center;gap:8px}
    .sec-title::after{content:'';flex:1;height:1px;background:var(--border)}
    .sec-gap{margin-bottom:36px}
    .grid{display:grid;gap:14px}
    .g2{grid-template-columns:repeat(2,1fr)}
    .g3{grid-template-columns:repeat(3,1fr)}
    .g4{grid-template-columns:repeat(4,1fr)}
    /* KPI CARDS */
    .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px 22px;position:relative;overflow:hidden;transition:transform .2s,box-shadow .2s}
    .card:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,0.3)}
    .card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;border-radius:var(--radius) var(--radius) 0 0}
    .card.green::before{background:var(--green)}.card.blue::before{background:var(--blue)}
    .card.cyan::before{background:var(--cyan)}.card.gold::before{background:var(--gold)}
    .card.purple::before{background:var(--purple)}.card.orange::before{background:var(--orange)}
    .kpi-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted);margin-bottom:10px}
    .kpi-val{font-size:26px;font-weight:900;line-height:1.1;letter-spacing:-0.02em}
    .kpi-val.green{color:var(--green)}.kpi-val.blue{color:var(--blue)}.kpi-val.cyan{color:var(--cyan)}.kpi-val.gold{color:var(--gold)}
    .kpi-sub{font-size:12px;color:var(--muted);margin-top:6px;font-weight:500}
    /* SOURCE PILLS */
    .src-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
    .src-pill{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:10px}
    .src-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
    .src-name{font-size:12px;color:var(--muted);font-weight:600}
    .src-val{font-size:14px;font-weight:800;color:var(--text);margin-top:2px}
    .src-cnt{font-size:11px;color:var(--muted)}
    /* MISSING */
    .miss{background:var(--surface);border:1px dashed rgba(255,255,255,0.12);border-radius:var(--radius);padding:28px;text-align:center}
    .miss-ico{font-size:32px;margin-bottom:10px;opacity:0.4}
    .miss-lbl{font-size:14px;font-weight:700;color:var(--muted)}
    .miss-sub{font-size:12px;color:rgba(139,148,163,0.6);margin-top:5px}
    .miss-tag{display:inline-block;background:rgba(244,63,94,0.08);border:1px solid rgba(244,63,94,0.2);color:#f87171;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;padding:3px 10px;border-radius:20px;margin-top:10px}
    /* PODIUM */
    .podium-wrap{display:flex;align-items:flex-end;justify-content:center;gap:16px;padding:20px 0 0}
    .pod-item{display:flex;flex-direction:column;align-items:center}
    .pod-avatar{border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;margin-bottom:10px;border:3px solid transparent;position:relative}
    .pod-avatar.p1{background:linear-gradient(135deg,#f59e0b,#d97706);border-color:#fbbf24;width:68px;height:68px;font-size:22px;box-shadow:0 0 24px rgba(245,158,11,0.5)}
    .pod-avatar.p2{background:linear-gradient(135deg,#94a3b8,#64748b);border-color:#94a3b8;width:56px;height:56px;font-size:18px;box-shadow:0 0 16px rgba(148,163,184,0.3)}
    .pod-avatar.p3{background:linear-gradient(135deg,#fb923c,#ea580c);border-color:#fb923c;width:56px;height:56px;font-size:18px;box-shadow:0 0 16px rgba(251,146,60,0.3)}
    .pod-crown{position:absolute;top:-14px;font-size:18px}
    .pod-name{font-size:12px;font-weight:700;color:var(--text);text-align:center;max-width:90px}
    .pod-rev{font-size:13px;font-weight:800;margin-top:3px}
    .pod-rev.p1{color:var(--gold)}.pod-rev.p2{color:#94a3b8}.pod-rev.p3{color:var(--orange)}
    .pod-deals{font-size:11px;color:var(--muted);margin-top:2px}
    .pod-block{border-radius:10px 10px 0 0;width:100%;display:flex;align-items:center;justify-content:center;margin-top:10px;font-size:22px;min-width:100px}
    .pod-block.p1{background:linear-gradient(180deg,rgba(245,158,11,0.3),rgba(245,158,11,0.1));height:80px}
    .pod-block.p2{background:linear-gradient(180deg,rgba(148,163,184,0.25),rgba(148,163,184,0.08));height:56px;min-width:90px}
    .pod-block.p3{background:linear-gradient(180deg,rgba(251,146,60,0.25),rgba(251,146,60,0.08));height:40px;min-width:90px}
    /* CHART CARD */
    .chart-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px}
    .chart-title{font-size:15px;font-weight:800;color:var(--text);margin-bottom:20px;display:flex;align-items:center;justify-content:space-between}
    .cbadge{font-size:11px;font-weight:700;background:rgba(99,102,241,0.12);color:var(--blue);padding:3px 10px;border-radius:20px}
    .cbadge.green{background:rgba(16,185,129,0.12);color:var(--green)}
    .cbadge.gold{background:rgba(245,158,11,0.12);color:var(--gold)}
    canvas{max-height:220px}
    /* PERIOD */
    .period-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:22px 24px;display:flex;align-items:center;gap:16px}
    .period-ico{font-size:32px}
    .period-lbl{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted)}
    .period-val{font-size:24px;font-weight:900;margin-top:4px;letter-spacing:-0.02em}
    .period-val.green{color:var(--green)}.period-val.blue{color:var(--blue)}
    .period-sub{font-size:12px;color:var(--muted);margin-top:3px}
    /* FUNNEL TABLE */
    .ftbl{width:100%;border-collapse:collapse;font-size:13px}
    .ftbl th{text-align:left;padding:10px 14px;background:var(--surface2);color:var(--muted);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em}
    .ftbl td{padding:10px 14px;border-bottom:1px solid var(--border)}
    .ftbl tr:last-child td{border-bottom:none}
    .fbar-wrap{display:flex;align-items:center;gap:10px}
    .fbar-bg{flex:1;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden}
    .fbar-fill{height:100%;border-radius:3px}
    .fpct{font-size:12px;font-weight:700;color:var(--cyan);width:44px;text-align:right}
    /* NET */
    .net-row{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--border)}
    .net-row:last-child{border-bottom:none}
    /* LOADING */
    #loading{position:fixed;inset:0;background:var(--bg);display:flex;align-items:center;justify-content:center;z-index:999;flex-direction:column;gap:16px}
    .loader{width:40px;height:40px;border:3px solid rgba(99,102,241,0.2);border-top-color:var(--blue);border-radius:50%;animation:spin .8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    @media print{body{background:#fff!important}.print-btn{display:none!important}#loading{display:none!important}}
    @media(max-width:768px){.g4,.g3{grid-template-columns:repeat(2,1fr)}.src-grid{grid-template-columns:repeat(2,1fr)}.wrap{padding:20px 16px 0}.rpt-header{padding:24px 20px}}
  </style>
</head>
<body>
<div id="loading">
  <div class="loader"></div>
  <div style="font-size:14px;color:#8896b3;font-weight:600;">Loading report data\u2026</div>
</div>

<div class="rpt-header">
  <div>
    <h1>\ud83d\udc4b Hi <span>Aman</span></h1>
    <div class="header-meta" id="hdr-sub">Daily Sales &amp; Revenue Report</div>
  </div>
  <div class="header-right">
    <div class="date-badge" id="hdr-date">\ud83d\udcc5 \u2014</div>
    <button class="print-btn" onclick="window.print()">\ud83d\udda8\ufe0f Export as PDF</button>
  </div>
</div>

<div class="wrap">

  <!-- 1. REVENUE -->
  <div class="sec-gap" style="margin-top:32px">
    <div class="sec-title">\ud83d\udcb0 Revenue \u2014 Till 11:59 PM Yesterday</div>
    <div class="card green">
      <div class="kpi-lbl">Total Revenue Generated</div>
      <div class="kpi-val green" id="total-rev">\u2014</div>
      <div class="kpi-sub" id="total-rev-sub">\u2014</div>
      <div class="src-grid" id="src-grid"></div>
    </div>
  </div>

  <!-- 2. DEALS + AOV + HIGHEST SALE -->
  <div class="sec-gap">
    <div class="sec-title">\ud83e\udd1d Deals &amp; Averages</div>
    <div class="grid g3">
      <div class="card blue">
        <div class="kpi-lbl">Deals Closed</div>
        <div class="kpi-val blue" id="deals-closed">\u2014</div>
        <div class="kpi-sub">Sales + Self-Subscription</div>
      </div>
      <div class="card cyan">
        <div class="kpi-lbl">Blended AOV</div>
        <div class="kpi-val cyan" id="blended-aov">\u2014</div>
        <div class="kpi-sub">Total Revenue \u00f7 Total Deals</div>
      </div>
      <div class="card gold">
        <div class="kpi-lbl">\ud83c\udfc6 Highest Sale (Avg/Deal)</div>
        <div class="kpi-val gold" id="highest-sale">\u2014</div>
        <div class="kpi-sub" id="highest-sale-sub">\u2014</div>
      </div>
    </div>
  </div>

  <!-- 3. LEADS (MISSING) -->
  <div class="sec-gap">
    <div class="sec-title">\ud83c\udfaf Lead Intelligence</div>
    <div class="grid g2">
      <div class="miss">
        <div class="miss-ico">\ud83d\udccb</div>
        <div class="miss-lbl">Total Leads Generated</div>
        <div class="miss-sub">Awaiting leads data sheet (CRM / Form source)</div>
        <div class="miss-tag">\u26a0 Data Needed</div>
      </div>
      <div class="miss">
        <div class="miss-ico">\u23f0</div>
        <div class="miss-lbl">Leads Missed (&gt;8 hrs, no activity)</div>
        <div class="miss-sub">Fresh / Interested / PD \u2014 CRM export required</div>
        <div class="miss-tag">\u26a0 Data Needed</div>
      </div>
    </div>
  </div>

  <!-- 4. PODIUM -->
  <div class="sec-gap">
    <div class="sec-title">\ud83c\udfc6 Top 3 Sales Agents \u2014 Yesterday</div>
    <div class="chart-card">
      <div class="podium-wrap" id="podium"></div>
    </div>
  </div>

  <!-- 5. PERIOD REVENUE -->
  <div class="sec-gap">
    <div class="sec-title">\ud83d\udcc6 Period Revenue</div>
    <div class="grid g2">
      <div class="period-card">
        <div class="period-ico">\ud83d\udcc5</div>
        <div>
          <div class="period-lbl">Revenue This Week (Sun\u2013Today)</div>
          <div class="period-val green" id="rev-week">\u2014</div>
          <div class="period-sub" id="rev-week-sub">\u2014</div>
        </div>
      </div>
      <div class="period-card">
        <div class="period-ico">\ud83d\uddd3\ufe0f</div>
        <div>
          <div class="period-lbl">Revenue This Month (1st\u2013Today)</div>
          <div class="period-val blue" id="rev-month">\u2014</div>
          <div class="period-sub" id="rev-month-sub">\u2014</div>
        </div>
      </div>
    </div>
  </div>

  <!-- 6. PLAN DISTRIBUTION -->
  <div class="sec-gap">
    <div class="sec-title">\ud83e\udd67 Plan Distribution \u2014 Yesterday</div>
    <div class="chart-card">
      <div class="chart-title">Plan Mix by Deals <span class="cbadge gold">By Volume</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:center">
        <canvas id="planChart"></canvas>
        <div id="plan-tbl"></div>
      </div>
    </div>
  </div>

  <!-- 7. REFUNDS (MISSING) -->
  <div class="sec-gap">
    <div class="sec-title">\ud83d\udcb8 Refunds</div>
    <div class="grid g2">
      <div class="miss">
        <div class="miss-ico">\ud83d\udd04</div>
        <div class="miss-lbl">Refund Processed (Yesterday)</div>
        <div class="miss-sub">Awaiting refunds sheet \u2014 Date, Amount, Reason</div>
        <div class="miss-tag">\u26a0 Data Needed</div>
      </div>
      <div class="miss">
        <div class="miss-ico">\ud83d\udcca</div>
        <div class="miss-lbl">Refund Processed (Last 7 Days)</div>
        <div class="miss-sub">Awaiting refunds sheet \u2014 rolling 7-day total</div>
        <div class="miss-tag">\u26a0 Data Needed</div>
      </div>
    </div>
  </div>

  <!-- 8. SERVICEABILITY -->
  <div class="sec-gap">
    <div class="sec-title">\ud83d\udccd Serviceability \u2014 Last 7 Days</div>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:14px">
      <div class="chart-card">
        <div class="chart-title">Serviceability % Trend <span class="cbadge green">7-Day</span></div>
        <canvas id="svcChart"></canvas>
      </div>
      <div class="chart-card" style="padding:0;overflow:hidden">
        <div style="padding:20px 20px 0;font-size:15px;font-weight:800">Daily Funnel Snapshot</div>
        <table class="ftbl" style="margin-top:12px">
          <thead><tr><th>Date</th><th>Signups</th><th>Serviceable</th><th>Rate</th></tr></thead>
          <tbody id="ftbl-body"></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- 9. SALES TREND -->
  <div class="sec-gap">
    <div class="sec-title">\ud83d\udcc8 Sales Trend \u2014 Last 7 Days</div>
    <div class="chart-card">
      <div class="chart-title">Daily Revenue (Last 7 Days) <span class="cbadge">Bar Chart</span></div>
      <canvas id="trendChart" style="max-height:240px"></canvas>
    </div>
  </div>

  <!-- 10. DELIVERY + NET REVENUE -->
  <div class="sec-gap">
    <div class="sec-title">\ud83d\udcbc Financials</div>
    <div class="grid g2">
      <div class="miss">
        <div class="miss-ico">\ud83d\ude9a</div>
        <div class="miss-lbl">Delivery Fee Collected</div>
        <div class="miss-sub">Awaiting delivery fee sheet \u2014 Date, Fee Amount</div>
        <div class="miss-tag">\u26a0 Data Needed</div>
      </div>
      <div class="chart-card" style="padding:0;overflow:hidden">
        <div style="padding:20px 20px 12px;font-size:15px;font-weight:800">\ud83e\uddf2 Net Revenue</div>
        <div class="net-row">
          <span style="font-size:14px;font-weight:600;color:var(--muted)">Total Sales Revenue</span>
          <span style="font-size:16px;font-weight:800;color:var(--green)" id="net-sales">\u2014</span>
        </div>
        <div class="net-row">
          <span style="font-size:14px;font-weight:600;color:var(--muted)">\u2212 Refunds Processed</span>
          <span style="font-size:13px;color:var(--muted)">\u26a0 Awaiting data</span>
        </div>
        <div class="net-row" style="background:rgba(16,185,129,0.05)">
          <span style="font-size:14px;font-weight:700;color:var(--text)">= Net Revenue</span>
          <span style="font-size:13px;color:var(--muted)">\u26a0 Awaiting refund data</span>
        </div>
      </div>
    </div>
  </div>

  <div style="text-align:center;padding:20px 0 0;font-size:12px;color:rgba(136,150,179,0.5);border-top:1px solid var(--border);margin-top:8px">
    \ud83d\udc18 The Elefant \u2014 Automated Daily Sales Intelligence Report &nbsp;|&nbsp; Generated daily at 10:00 AM IST
  </div>
</div>

<script>
const fmt = n => '\u20b9' + Math.round(n||0).toLocaleString('en-IN');
const fmtK = n => { n=Math.round(n||0); if(n>=100000) return '\u20b9'+(n/100000).toFixed(1)+'L'; if(n>=1000) return '\u20b9'+(n/1000).toFixed(1)+'K'; return '\u20b9'+n.toLocaleString('en-IN'); };
const sd = iso => new Date(iso+'T00:00:00').toLocaleDateString('en-IN',{month:'short',day:'numeric'});
const fd = iso => new Date(iso+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
const ini = n => n.split(' ').map(x=>x[0]).join('').substring(0,2).toUpperCase();
const SRC_C = {Events:'#6366f1',Organic:'#10b981',Renewals:'#f59e0b',Upgrade:'#06b6d4','Self Subscription':'#8b5cf6'};
const SRC_L = {Organic:'\ud83e\udd1d Inside Sales',Events:'\ud83c\udfa4 Events',Renewals:'\ud83d\udd04 Renewals',Upgrade:'\u2b06\ufe0f Upgrades','Self Subscription':'\ud83d\udcf1 Self Sub'};
const PC = ['#6366f1','#10b981','#06b6d4','#f59e0b','#f43f5e','#8b5cf6','#fb923c'];

async function init() {
  try {
    const data = await fetch('/data/data.json').then(r=>r.json());
    data.sort((a,b)=>a.date.localeCompare(b.date));
    const yd = data[data.length-1];

    document.getElementById('hdr-date').textContent = '\ud83d\udcc5 ' + sd(yd.date) + ', ' + new Date(yd.date+'T00:00:00').getFullYear();
    document.getElementById('hdr-sub').textContent = 'Data as of 11:59 PM, ' + fd(yd.date);

    // Revenue
    document.getElementById('total-rev').textContent = fmt(yd.totalRevenue||0);
    document.getElementById('total-rev-sub').textContent = (yd.salesCount||0) + ' deals across all channels';
    const sg = document.getElementById('src-grid');
    sg.innerHTML = '';
    Object.entries(yd.sources||{}).sort((a,b)=>b[1].revenue-a[1].revenue).forEach(([src,d])=>{
      const c = SRC_C[src]||'#8896b3'; const l = SRC_L[src]||src;
      sg.innerHTML += '<div class="src-pill"><div class="src-dot" style="background:'+c+';box-shadow:0 0 6px '+c+'88"></div><div><div class="src-name">'+l+'</div><div class="src-val">'+fmt(d.revenue)+'</div><div class="src-cnt">'+d.count+' deal'+(d.count!==1?'s':'')+'</div></div></div>';
    });

    // Deals + AOV
    const rev = yd.totalRevenue||0; const cnt = yd.salesCount||0;
    document.getElementById('deals-closed').textContent = cnt + ' deals';
    document.getElementById('blended-aov').textContent = fmt(cnt>0?Math.round(rev/cnt):0);
    const ag = Object.entries(yd.agents||{}).sort((a,b)=>b[1].revenue-a[1].revenue);
    const ags = ag.map(([n,d])=>({n,d,avg:d.count>0?d.revenue/d.count:0})).sort((a,b)=>b.avg-a.avg);
    if(ags.length){
      document.getElementById('highest-sale').textContent = fmt(ags[0].avg);
      document.getElementById('highest-sale-sub').textContent = ags[0].n + ' \u00b7 avg per deal';
    }

    // Podium
    const top3 = ag.slice(0,3);
    const pw = document.getElementById('podium');
    if(!top3.length){ pw.innerHTML='<div style="color:#8896b3">No agent data.</div>'; }
    else {
      const order = top3.length>=3?[top3[1],top3[0],top3[2]]:top3.length===2?[top3[1],top3[0]]:[top3[0]];
      const pcs = top3.length>=3?['p2','p1','p3']:top3.length===2?['p2','p1']:['p1'];
      const medals = {p1:'\ud83e\udd47',p2:'\ud83e\udd48',p3:'\ud83e\udd49'};
      pw.innerHTML = order.map(([n,d],i)=>{
        const pc=pcs[i]; const rank=pc==='p1'?1:pc==='p2'?2:3;
        return '<div class="pod-item"><div class="pod-avatar '+pc+'">'+(rank===1?'<div class="pod-crown">\ud83d\udc51</div>':'')+ini(n)+'</div><div class="pod-name">'+n.split(' ')[0]+'<br><span style="font-size:10px;color:var(--muted)">'+n.split(' ').slice(1).join(' ')+'</span></div><div class="pod-rev '+pc+'">'+fmt(d.revenue)+'</div><div class="pod-deals">'+d.count+' deal'+(d.count!==1?'s':'')+'</div><div class="pod-block '+pc+'">'+medals[pc]+'</div></div>';
      }).join('');
    }

    // Period
    const yDate = new Date(yd.date+'T00:00:00');
    const dow = yDate.getDay();
    const sun = new Date(yDate); sun.setDate(yDate.getDate()-dow);
    const sunStr = sun.toISOString().slice(0,10);
    const wData = data.filter(d=>d.date>=sunStr&&d.date<=yd.date);
    const wRev = wData.reduce((s,d)=>s+(d.totalRevenue||0),0);
    document.getElementById('rev-week').textContent = fmt(wRev);
    document.getElementById('rev-week-sub').textContent = sd(sunStr)+' \u2192 '+sd(yd.date)+' \u00b7 '+wData.length+' days \u00b7 '+wData.reduce((s,d)=>s+(d.salesCount||0),0)+' deals';
    const mStr = yd.date.slice(0,7)+'-01';
    const mData = data.filter(d=>d.date>=mStr&&d.date<=yd.date);
    const mRev = mData.reduce((s,d)=>s+(d.totalRevenue||0),0);
    document.getElementById('rev-month').textContent = fmt(mRev);
    document.getElementById('rev-month-sub').textContent = sd(mStr)+' \u2192 '+sd(yd.date)+' \u00b7 '+mData.length+' days \u00b7 '+mData.reduce((s,d)=>s+(d.salesCount||0),0)+' deals';

    // Plan pie
    const plans = yd.plans||{};
    const pLabels = Object.keys(plans);
    const pCounts = pLabels.map(p=>plans[p].count);
    const pRevs = pLabels.map(p=>plans[p].revenue);
    const pTotal = pCounts.reduce((a,b)=>a+b,0);
    const pTotalR = pRevs.reduce((a,b)=>a+b,0);
    new Chart(document.getElementById('planChart'),{type:'doughnut',data:{labels:pLabels,datasets:[{data:pCounts,backgroundColor:PC.slice(0,pLabels.length),borderWidth:2,borderColor:'#0f1630',hoverOffset:6}]},options:{responsive:true,cutout:'62%',plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' '+ctx.label+': '+ctx.parsed+' ('+(pTotal>0?((ctx.parsed/pTotal)*100).toFixed(1):0)+'%)'}}}}}});
    document.getElementById('plan-tbl').innerHTML = '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);margin-bottom:10px">Plan Breakdown</div>'+pLabels.map((p,i)=>'<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><div style="width:10px;height:10px;border-radius:2px;background:'+PC[i]+';flex-shrink:0"></div><div style="flex:1"><div style="font-size:12px;font-weight:700;color:var(--text)">'+p+'</div><div style="font-size:11px;color:var(--muted)">'+plans[p].count+' deals \u00b7 '+fmt(plans[p].revenue)+'</div></div><div style="font-size:13px;font-weight:800;color:'+PC[i]+'">'+( pTotal>0?((plans[p].count/pTotal)*100).toFixed(1):0 )+'%</div></div>').join('')+'<div style="border-top:1px solid var(--border);padding-top:8px;display:flex;justify-content:space-between;font-size:12px;font-weight:700"><span style="color:var(--muted)">Total</span><span style="color:var(--text)">'+pTotal+' deals \u00b7 '+fmt(pTotalR)+'</span></div>';

    // Serviceability
    const l7 = data.slice(-7);
    const sLabels = l7.map(d=>sd(d.date));
    const sPcts = l7.map(d=>parseFloat(d.userBreakdown?.serviceablePct)||0);
    new Chart(document.getElementById('svcChart'),{type:'line',data:{labels:sLabels,datasets:[{label:'Serviceability %',data:sPcts,borderColor:'#06b6d4',backgroundColor:'rgba(6,182,212,0.08)',fill:true,tension:0.4,pointRadius:4,pointBackgroundColor:'#06b6d4',pointBorderColor:'#0f1630',pointBorderWidth:2}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#8896b3',font:{size:11}},grid:{color:'rgba(255,255,255,0.04)'}},y:{ticks:{color:'#8896b3',font:{size:11},callback:v=>v+'%'},grid:{color:'rgba(255,255,255,0.04)'},min:0,max:100}}}});
    document.getElementById('ftbl-body').innerHTML = l7.map(d=>{const ub=d.userBreakdown;const pct=ub?parseFloat(ub.serviceablePct)||0:0;const col=pct>=60?'#10b981':pct>=40?'#f59e0b':'#f43f5e';return '<tr><td style="font-weight:600;color:var(--text)">'+sd(d.date)+'</td><td style="color:var(--muted)">'+(ub?.signups||0).toLocaleString('en-IN')+'</td><td style="color:#06b6d4">'+(ub?.serviceable||0).toLocaleString('en-IN')+'</td><td><div class="fbar-wrap"><div class="fbar-bg"><div class="fbar-fill" style="width:'+pct+'%;background:'+col+'"></div></div><div class="fpct" style="color:'+col+'">'+pct+'%</div></div></td></tr>';}).join('');

    // Trend
    const tRevs = l7.map(d=>d.totalRevenue||0);
    const maxR = Math.max(...tRevs);
    new Chart(document.getElementById('trendChart'),{type:'bar',data:{labels:sLabels,datasets:[{label:'Revenue',data:tRevs,backgroundColor:tRevs.map(r=>r===maxR?'rgba(245,158,11,0.85)':'rgba(99,102,241,0.7)'),borderRadius:8,borderSkipped:false}]},options:{responsive:true,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' '+fmt(ctx.parsed.y)}}},scales:{x:{ticks:{color:'#8896b3',font:{size:11}},grid:{display:false}},y:{ticks:{color:'#8896b3',font:{size:11},callback:v=>fmtK(v)},grid:{color:'rgba(255,255,255,0.04)'}}}}});

    // Net
    document.getElementById('net-sales').textContent = fmt(yd.totalRevenue||0);
    document.getElementById('loading').style.display = 'none';
  } catch(err) {
    document.getElementById('loading').innerHTML = '<div style="color:#f43f5e;font-size:14px;font-weight:700">\u26a0 Could not load data</div><div style="color:#8896b3;font-size:12px;margin-top:8px">'+err.message+'</div><div style="color:#8896b3;font-size:12px;margin-top:4px">Make sure server is running: npm start</div>';
  }
}
init();
<\/script>
</body>
</html>`;

fs.writeFileSync(OUT, html, 'utf8');
console.log('SUCCESS: daily-report.html written to', OUT);
