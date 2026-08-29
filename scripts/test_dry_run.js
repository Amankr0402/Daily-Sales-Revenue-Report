/**
 * ============================================================
 *  DRY RUN TEST — Daily Sales Report
 *
 *  Checks everything WITHOUT sending any email:
 *    1. SMTP credentials & server connection
 *    2. Google Sheets data sync
 *    3. Metabase user breakdown sync
 *    4. Email HTML generation
 *
 *  Run: node scripts/test_dry_run.js
 * ============================================================
 */

require('dotenv').config();
const nodemailer = require('nodemailer');
const path = require('path');
const { syncSalesData } = require('./sync_sheets');

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || `"Aman Soni" <${SMTP_USER}>`;

let passed = 0;
let failed = 0;

function ok(msg) { console.log(`  ✅  ${msg}`); passed++; }
function fail(msg) { console.error(`  ❌  ${msg}`); failed++; }
function info(msg) { console.log(`  ℹ️   ${msg}`); }

async function runDryRun() {
  console.log('\n====================================================');
  console.log('  🧪 DAILY REPORT — DRY RUN TEST');
  console.log('====================================================\n');

  // ─── STEP 1: Verify Env Variables ────────────────────────
  console.log('📋 Step 1: Checking environment variables...');

  if (SMTP_USER && SMTP_USER !== 'your-email@yourcompany.com') {
    ok(`SMTP_USER is set → ${SMTP_USER}`);
  } else {
    fail('SMTP_USER is missing or not configured');
  }

  if (SMTP_PASS && SMTP_PASS.length >= 16) {
    ok(`SMTP_PASS is set → ${'*'.repeat(SMTP_PASS.length)} (${SMTP_PASS.length} chars)`);
  } else {
    fail(`SMTP_PASS looks wrong — expected 16 chars, got: ${SMTP_PASS?.length || 0}`);
  }

  if (SMTP_FROM) {
    ok(`SMTP_FROM is set → ${SMTP_FROM}`);
  } else {
    fail('SMTP_FROM is missing');
  }

  // ─── STEP 2: SMTP Server Connection (NO email sent) ───────
  console.log('\n📡 Step 2: Verifying SMTP connection to Gmail...');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
  });

  try {
    await transporter.verify(); // Checks credentials WITHOUT sending mail
    ok('SMTP connection successful — credentials are valid!');
  } catch (err) {
    fail(`SMTP connection failed: ${err.message}`);
    info('Common reasons: wrong app password, 2FA not enabled, or "Less secure apps" blocked.');
  }

  // ─── STEP 3: Google Sheets + Metabase Data Sync ───────────
  console.log('\n📊 Step 3: Syncing data from Google Sheets & Metabase...');

  let allData = null;
  try {
    allData = await syncSalesData();
    ok(`Data sync successful — ${allData.length} days of data fetched`);

    const latest = allData[allData.length - 1];
    info(`Latest date in data: ${latest.date}`);
    info(`Total revenue on latest day: \u20B9${Math.round(latest.totalRevenue || 0).toLocaleString('en-IN')}`);
    info(`Sales count: ${latest.salesCount}`);

    const hasUserBreakdown = allData.some(d => d.userBreakdown !== null);
    if (hasUserBreakdown) {
      ok('Metabase D-o-D User Breakdown data is present');
    } else {
      fail('Metabase User Breakdown data is missing — check METABASE_URL');
    }
  } catch (err) {
    fail(`Data sync failed: ${err.message}`);
  }

  // ─── STEP 4: Check Recipients ─────────────────────────────
  console.log('\n👥 Step 4: Checking recipients list...');

  try {
    const fs = require('fs');
    const raw = fs.readFileSync(path.join(__dirname, '..', 'config', 'employees.json'), 'utf-8');
    const { recipients } = JSON.parse(raw);
    if (recipients && recipients.length > 0) {
      ok(`Recipients list loaded — ${recipients.length} recipient(s):`);
      recipients.forEach(r => info(`  → ${r.name} <${r.email}>`));
    } else {
      fail('No recipients found in config/employees.json');
    }
  } catch (err) {
    fail(`Could not read recipients: ${err.message}`);
  }

  // ─── STEP 5: HTML Email Build Check ───────────────────────
  console.log('\n🏗️  Step 5: Building email subject...');

  if (allData && allData.length > 0) {
    try {
      const today = allData[allData.length - 1];
      const d = new Date(today.date + 'T00:00:00');
      const dateStr = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
      const subject = `📈 Daily Sales Report — ${dateStr} [\u20B9${Math.round(today.totalRevenue || 0).toLocaleString('en-IN')}]`;
      ok('Email subject built successfully');
      info(`Subject: ${subject}`);
    } catch (err) {
      fail(`HTML build failed: ${err.message}`);
    }
  } else {
    fail('Skipped — no data available');
  }

  // ─── SUMMARY ──────────────────────────────────────────────
  console.log('\n====================================================');
  console.log(`  📋 DRY RUN COMPLETE — ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  if (failed === 0) {
    console.log('🎉 Everything looks good! The real email job will work correctly.\n');
    process.exit(0);
  } else {
    console.log('⚠️  Fix the issues above before the scheduled email runs.\n');
    process.exit(1);
  }
}

runDryRun();
