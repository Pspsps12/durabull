const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:5173';
const TEST_ORG_SLUG = 'acme';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  console.log('\n🔍 BUTTON HEIGHT VERIFICATION AFTER FIX\n');
  console.log('=' .repeat(80));
  
  try {
    // Login first
    console.log('\n🔐 Logging in...');
    await page.goto(`${TARGET_URL}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    await page.getByLabel('Email').fill('admin@example.com');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForTimeout(3000);
    console.log('✅ Logged in successfully\n');
    
    // Helper function to verify and measure
    async function verifyPage(pageName, url) {
      console.log('='.repeat(80));
      console.log(`📍 ${pageName.toUpperCase()}`);
      console.log(`🔗 ${url}`);
      console.log('-'.repeat(80));
      
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);
      
      // Take screenshot of top bar area
      await page.screenshot({ 
        path: `/tmp/verify-${pageName.toLowerCase().replace(/\s+/g, '-')}.png`,
        clip: { x: 0, y: 0, width: 1920, height: 100 }
      });
      
      // Execute the exact JavaScript requested
      const measurements = await page.evaluate(() => {
        const buttons = document.querySelectorAll('header button:not([class*="md:hidden"])');
        return Array.from(buttons).map(b => ({
          text: b.textContent.trim().substring(0, 30),
          clientHeight: b.clientHeight,
          offsetHeight: b.offsetHeight
        }));
      });
      
      console.log('\n📊 Button Measurements:');
      console.log(JSON.stringify(measurements, null, 2));
      
      // Filter out 0-height buttons (hidden) and check consistency
      const visibleButtons = measurements.filter(m => m.clientHeight > 0);
      const clientHeights = new Set(visibleButtons.map(m => m.clientHeight));
      
      console.log(`\n📏 Visible buttons: ${visibleButtons.length}`);
      console.log(`📏 Unique clientHeight values: ${Array.from(clientHeights).sort((a, b) => a - b).join('px, ')}px`);
      
      if (clientHeights.size === 0) {
        console.log('⚠️  No visible buttons found');
      } else if (clientHeights.size === 1) {
        console.log(`✅ All buttons have consistent clientHeight: ${Array.from(clientHeights)[0]}px`);
      } else {
        console.log('❌ INCONSISTENT: Buttons have different clientHeight values!');
      }
      
      // Also check the .ml-auto buttons specifically
      const mlAutoButtons = await page.evaluate(() => {
        const buttons = document.querySelectorAll('header .ml-auto button');
        return Array.from(buttons).map(b => ({
          text: b.textContent.trim(),
          clientHeight: b.clientHeight,
          offsetHeight: b.offsetHeight,
          hasBorder: window.getComputedStyle(b).borderTopWidth !== '0px',
          borderWidth: window.getComputedStyle(b).borderTopWidth,
          classes: b.className.split(' ').filter(c => c.includes('border') || c.includes('bg-')).join(' ')
        }));
      });
      
      if (mlAutoButtons.length > 0) {
        console.log('\n🎯 Top-right (.ml-auto) buttons:');
        mlAutoButtons.forEach((btn, idx) => {
          const borderInfo = btn.hasBorder ? `(border: ${btn.borderWidth})` : '(no border)';
          console.log(`  ${idx + 1}. "${btn.text}" - clientHeight: ${btn.clientHeight}px ${borderInfo}`);
          console.log(`     Classes: ${btn.classes}`);
        });
      }
      
      console.log(`\n📸 Screenshot: /tmp/verify-${pageName.toLowerCase().replace(/\s+/g, '-')}.png\n`);
      
      return { measurements, visibleButtons, clientHeights: Array.from(clientHeights) };
    }
    
    const results = {};
    
    // Get connection ID first
    await page.goto(`${TARGET_URL}/${TEST_ORG_SLUG}/connections`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    
    const connectionLinks = await page.locator('a[href*="/c/"]').all();
    let connectionId = null;
    if (connectionLinks.length > 0) {
      const href = await connectionLinks[0].getAttribute('href');
      const match = href?.match(/\/c\/([^/]+)/);
      if (match) connectionId = match[1];
    }
    
    if (!connectionId) {
      throw new Error('Could not find a connection ID');
    }
    
    // 1. Connections Page
    results.connections = await verifyPage(
      'Connections Page',
      `${TARGET_URL}/${TEST_ORG_SLUG}/connections`
    );
    
    // Find a queue
    await page.goto(`${TARGET_URL}/${TEST_ORG_SLUG}/c/${connectionId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    
    const queueLinks = await page.locator('a[href*="/queues/"]').all();
    let queueName = null;
    if (queueLinks.length > 0) {
      const href = await queueLinks[0].getAttribute('href');
      const match = href?.match(/\/queues\/([^/]+)/);
      if (match) queueName = match[1];
    }
    
    if (queueName) {
      // 2. Queue Detail Page
      results.queueDetail = await verifyPage(
        'Queue Detail',
        `${TARGET_URL}/${TEST_ORG_SLUG}/c/${connectionId}/queues/${queueName}`
      );
      
      // Find a job
      const jobLinks = await page.locator('a[href*="/jobs/"]').all();
      let jobId = null;
      if (jobLinks.length > 0) {
        const href = await jobLinks[0].getAttribute('href');
        const match = href?.match(/\/jobs\/([^/]+)/);
        if (match) jobId = match[1];
      }
      
      if (jobId) {
        // 3. Job Detail Page
        results.jobDetail = await verifyPage(
          'Job Detail',
          `${TARGET_URL}/${TEST_ORG_SLUG}/c/${connectionId}/queues/${queueName}/jobs/${jobId}`
        );
      }
    }
    
    // 4. Team Page
    results.team = await verifyPage(
      'Team Page',
      `${TARGET_URL}/${TEST_ORG_SLUG}/team`
    );
    
    // Final Summary
    console.log('='.repeat(80));
    console.log('📊 FINAL VERIFICATION SUMMARY');
    console.log('='.repeat(80));
    
    const allClientHeights = new Set();
    let allConsistent = true;
    
    for (const [pageName, data] of Object.entries(results)) {
      console.log(`\n${pageName.toUpperCase()}:`);
      console.log(`  Unique clientHeights: ${data.clientHeights.join('px, ')}px`);
      
      data.clientHeights.forEach(h => allClientHeights.add(h));
      
      if (data.clientHeights.length > 1) {
        console.log('  ❌ INCONSISTENT on this page');
        allConsistent = false;
      } else if (data.clientHeights.length === 1) {
        console.log(`  ✅ Consistent (${data.clientHeights[0]}px)`);
      }
    }
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📏 All unique clientHeight values across all pages: ${Array.from(allClientHeights).sort((a, b) => a - b).join('px, ')}px`);
    
    if (allClientHeights.size === 1) {
      console.log(`\n✅ SUCCESS! All buttons have consistent clientHeight: ${Array.from(allClientHeights)[0]}px`);
      console.log('✅ The fix worked! All buttons now have the same visual height.');
    } else if (allClientHeights.size > 1) {
      console.log('\n❌ INCONSISTENCY STILL EXISTS');
      console.log('The fix did not fully resolve the issue.');
    }
    
    console.log('='.repeat(80));
    console.log('\n✅ Verification complete!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await page.screenshot({ path: '/tmp/error-screenshot.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
