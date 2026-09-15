/**
 * Automated Daily Sales Report Pipeline for GitHub Actions & CI/CD
 * Uses the enhanced email sender with PDF attachment and live dashboard links
 */
require('dotenv').config();
const { sendDailyReport } = require('./send_report_now');

async function runPipeline() {
  try {
    console.log('🚀 Running Daily Sales Report Pipeline...');
    await sendDailyReport();
    console.log('✅ Pipeline finished successfully.');
  } catch (error) {
    console.error('❌ Pipeline failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runPipeline();
}

module.exports = { runPipeline };
