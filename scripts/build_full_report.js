/**
 * End-to-End Pipeline:
 * 1. Sync data
 * 2. Start temp Express server
 * 3. Puppeteer: render PDF
 * 4. Puppeteer: extract HTML, convert canvas to images for email
 * 5. Juice: Inline CSS
 * 6. Nodemailer: Send email + PDF + inline chart images
 */
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
const juice = require('juice').default || require('juice');

const { syncSalesData } = require('./sync_sheets');

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || `"Aman Soni" <${SMTP_USER}>`;

if (!SMTP_USER || !SMTP_PASS) {
  console.error('❌ Missing SMTP credentials! Set SMTP_USER and SMTP_PASS.');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  tls: { rejectUnauthorized: false },
  connectionTimeout: 20000,
  greetingTimeout: 20000,
});

function getRecipients() {
  const filePath = path.join(__dirname, '..', 'config', 'employees.json');
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { recipients } = JSON.parse(raw);
    return recipients.map(r => typeof r === 'string' ? r : r.email).filter(Boolean);
  }
  return ['aman.soni@theelefant.ai']; // Fallback
}

// 2. Temp Server
function startTempServer(port = 3001) {
  return new Promise((resolve) => {
    const app = express();
    app.use(express.static(path.join(__dirname, '..', 'public')));
    app.use('/data', express.static(path.join(__dirname, '..', 'data')));
    const server = app.listen(port, () => {
      resolve(server);
    });
  });
}

async function runPipeline() {
  let server;
  let browser;
  try {
    console.log('🔄 1. Syncing live data...');
    try {
      await syncSalesData();
    } catch (e) {
      console.warn('⚠️ Sync failed, proceeding with local data:', e.message);
    }

    console.log('🌐 2. Starting temp server on port 3001...');
    server = await startTempServer(3001);

    console.log('🚀 3. Launching Puppeteer...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
    
    console.log('⏳ 4. Loading dashboard and waiting for charts...');
    await page.goto('http://localhost:3001/index.html', { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Ensure charts finish animating (Chart.js default animation is ~1s)
    await new Promise(r => setTimeout(r, 2000));

    // Hide print button and loading overlay
    await page.evaluate(() => {
      const btn = document.querySelector('.print-btn');
      if (btn) btn.style.display = 'none';
      const loader = document.getElementById('loading');
      if (loader) loader.style.display = 'none';
    });

    console.log('📄 5. Generating PDF...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '8mm', right: '10mm', bottom: '8mm', left: '10mm' }
    });

    console.log('🖼️ 6. Extracting static HTML and Chart images...');
    const { html, attachments } = await page.evaluate(() => {
      const atts = [];
      const canvases = document.querySelectorAll('canvas');
      
      canvases.forEach((canvas, index) => {
        const base64 = canvas.toDataURL('image/png');
        const cid = `chart_${index}`;
        
        const img = document.createElement('img');
        img.src = `cid:${cid}`;
        img.style.width = '100%';
        img.style.maxWidth = canvas.style.width || canvas.width + 'px';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.margin = '0 auto';
        
        atts.push({ cid, base64: base64.split('base64,')[1] });
        canvas.parentNode.replaceChild(img, canvas);
      });

      return { html: document.documentElement.outerHTML, attachments: atts };
    });

    console.log('🧃 7. Inlining CSS with Juice...');
    const inlinedHtml = juice(html, { applyStyleTags: true, removeStyleTags: false, preserveMediaQueries: true });

    console.log('📧 8. Sending Email...');
    const recipients = getRecipients();
    const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    const mailAttachments = attachments.map(att => ({
      filename: `${att.cid}.png`,
      content: att.base64,
      encoding: 'base64',
      cid: att.cid
    }));

    mailAttachments.push({
      filename: `Daily_Sales_Report_${new Date().toISOString().split('T')[0]}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    });

    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to: recipients.join(', '),
      subject: `📈 Full Daily Sales & Revenue Report — ${today}`,
      html: inlinedHtml,
      attachments: mailAttachments
    });

    console.log(`✅ Email sent successfully to ${recipients.length} recipients! Message ID: ${info.messageId}`);

  } catch (error) {
    console.error('❌ Pipeline Error:', error);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    if (server) {
      server.close();
      console.log('🛑 Temp server shut down.');
    }
  }
}

runPipeline();
