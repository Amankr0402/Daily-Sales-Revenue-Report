const fs = require('fs');

const lines = fs.readFileSync('data/inside_sales_details.csv', 'utf8').split('\n');

function parseCSVLine(line) {
  const result = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += c; }
  }
  result.push(cur.trim());
  return result;
}

function parseDate(raw) {
  if (!raw) return null;
  const clean = raw.replace(/"/g, '').trim();
  if (clean.includes('-') && clean.length === 10) return clean;
  const parts = clean.split('/');
  if (parts.length === 3) {
    let [p1, p2, yr] = parts.map(Number);
    if (yr < 100) yr += 2000;
    let m, d;
    if (p1 > 12) { d = p1; m = p2; }
    else if (p2 > 12) { m = p1; d = p2; }
    else if (p1 === 11) { m = 11; d = p2; }
    else { m = p1; d = p2; }
    return `${yr}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  return null;
}

const allDeals = [];
for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  const cols = parseCSVLine(lines[i]).map(c => c.replace(/^"|"$/g, '').trim());
  const isoDate = parseDate(cols[1]);
  if (!isoDate) continue;
  const rev = parseFloat((cols[4] || '0').replace(/,/g, '')) || 0;
  if (rev <= 0) continue;
  const agent = (cols[3] || '').trim();
  if (!agent) continue;
  const cnt = parseFloat((cols[7] || '1').replace(/,/g, '')) || 1;
  const plan = cols[6] || 'Annual Max';
  const source = cols[8] || 'Organic';
  const dup = (cols[5] || '').toLowerCase();
  allDeals.push({ isoDate, agent, rev, cnt, plan, source, dup });
}

const nov10 = allDeals.filter(d => d.isoDate === '2026-11-10');
console.log('Nov 10 deals in CSV count:', nov10.length);

let ydRev = 0, ydCnt = 0;
let organicRev = 0, organicCnt = 0;
let renewalRev = 0, renewalCnt = 0;
let upgradeRev = 0, upgradeCnt = 0;

nov10.forEach(d => {
  ydRev += d.rev;
  ydCnt += d.cnt;
  const src = (d.source || '').toLowerCase();
  if (src.includes('renew'))        { renewalRev += d.rev; renewalCnt += d.cnt; }
  else if (src.includes('upgrade')) { upgradeRev += d.rev; upgradeCnt += d.cnt; }
  else if (src.includes('organic') || src === '') { organicRev += d.rev; organicCnt += d.cnt; }
});

console.log({
  totalDeals: nov10.length,
  ydRev,
  ydCnt,
  organicRev,
  organicCnt,
  renewalRev,
  renewalCnt,
  upgradeRev,
  upgradeCnt
});

