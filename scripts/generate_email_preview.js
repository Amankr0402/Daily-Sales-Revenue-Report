/**
 * Generates email_preview.html using the production buildEmailHtml template from send_report_now.js
 */
const fs = require('fs');
const path = require('path');
const { buildEmailHtml } = require('./send_report_now');

const dataPath = path.join(__dirname, '..', 'data', 'data.json');
const allData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
allData.sort((a, b) => a.date.localeCompare(b.date));

const html = buildEmailHtml(allData);
const outPath = path.join(__dirname, '..', 'public', 'email_preview.html');
fs.writeFileSync(outPath, html, 'utf-8');
console.log('✅ Generated email preview at:', outPath);
