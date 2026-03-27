const { chromium } = require('playwright');

async function testWebSocket() {
  console.log('🌐 Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Capture console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    if (text.includes('WebSocket') || text.includes('room') || text.includes('message')) {
      console.log(`  📝 ${text}`);
    }
  });
  
  console.log('\n🌐 Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  console.log('\n📋 Console logs after page load:');
  consoleLogs.slice(-20).forEach(log => console.log(`  ${log}`));
  
  // Check for room selection
  console.log('\n🔍 Checking for selected room...');
  const roomExists = await page.locator('.bg-blue-100, .bg-blue-50, [data-room]').count() > 0;
  console.log(roomExists ? '✅ Room found' : '❌ No room selected');
  
  // Find input and send message
  console.log('\n🔍 Looking for message input...');
  const inputField = page.locator('input[placeholder*="message"], input[type="text"]').first();
  
  if (await inputField.count() > 0) {
    console.log('✅ Input field found');
    console.log('\n✉️ Sending test message...');
    
    await inputField.fill('Playwright test message');
    
    const sendButton = page.locator('button:has-text("Send"), button[type="submit"]').first();
    if (await sendButton.count() > 0) {
      await sendButton.click();
      console.log('✅ Send button clicked');
      
      await page.waitForTimeout(3000);
      
      console.log('\n📋 Console logs after sending:');
      consoleLogs.slice(-30).forEach(log => {
        if (log.includes('WebSocket') || log.includes('message') || log.includes('room')) {
          console.log(`  ${log}`);
        }
      });
      
      // Check for WebSocket message receive
      const hasWebSocketMsg = consoleLogs.some(log => 
        log.includes('📩 WebSocket received message:new') || 
        log.includes('message:new')
      );
      
      console.log('\n' + (hasWebSocketMsg ? '✅ WebSocket message received!' : '❌ WebSocket message NOT received'));
      
      // Screenshot
      await page.screenshot({ path: '/tmp/chat-test.png', fullPage: true });
      console.log('📸 Screenshot: /tmp/chat-test.png');
    } else {
      console.log('❌ Send button not found');
    }
  } else {
    console.log('❌ Input field not found');
  }
  
  await browser.close();
  console.log('\n✅ Test complete!');
}

testWebSocket().catch(console.error);
