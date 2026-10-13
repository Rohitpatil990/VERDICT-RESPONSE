const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/scale-test', { waitUntil: 'networkidle0', timeout: 30000 });
    
    const screenshotPath = path.join(process.cwd(), 'artifacts', 'scale-test', 'VERDICT_500_REGION_SCALE_TEST.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    console.log(`Screenshot saved to: ${screenshotPath}`);
    await browser.close();
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
