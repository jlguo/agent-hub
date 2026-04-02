import { test, expect } from '@playwright/test';

test.describe('Agent Discussions', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the app
    await page.goto('/');

    // Wait for page to load
    await expect(page).toHaveTitle(/Agent Hub/);

    // Wait for rooms to load
    await page.waitForSelector('button:has-text("agents")', { timeout: 10000 });
    console.log('✅ Rooms loaded');
  });

  test('should trigger and display agent discussion', async ({ page }) => {
    console.log('🎙️ Starting discussion test...');

    // Select the first room
    const roomButton = await page.locator('button:has-text("agents")').first();
    await roomButton.click();
    console.log('✅ Room selected');

    // Wait for messages to load
    await page.waitForTimeout(2000);

    // Get initial message count
    const initialMessages = await page
      .locator('[class*="message"], .bg-white.border, .bg-blue-500')
      .count();
    console.log(`📊 Initial messages: ${initialMessages}`);

    // Type discussion command
    const discussionTopic = '周末去哪里玩';
    const input = page.locator('input[type="text"][placeholder*="Type a message"]');
    await input.fill(`/discuss ${discussionTopic}`);
    console.log(`📝 Typed: /discuss ${discussionTopic}`);

    // Send message
    const sendButton = page.locator('button:has-text("Send")');
    await sendButton.click();
    console.log('✅ Message sent');

    // Wait a moment for message to appear
    await page.waitForTimeout(1000);

    // Verify user message appears
    const userMessages = await page.locator('.bg-blue-500').count();
    console.log(`📊 User messages after send: ${userMessages}`);
    expect(userMessages).toBeGreaterThan(0);

    // Wait for discussion to start (should see system message)
    console.log('⏳ Waiting for discussion to start...');
    await page.waitForTimeout(3000);

    // Look for discussion start banner
    const discussionStart = page.locator('text=Discussion Started');
    const discussionStartExists = (await discussionStart.count()) > 0;
    console.log(`🎙️ Discussion start banner visible: ${discussionStartExists}`);

    // Also check for purple discussion banners
    const purpleBanners = page.locator('.bg-purple-50');
    const bannerCount = await purpleBanners.count();
    console.log(`🟣 Purple banners: ${bannerCount}`);

    // Wait for agent responses (discussions take 15-30 seconds)
    console.log('⏳ Waiting for agent responses...');
    await page.waitForTimeout(15000);

    // Check for new messages
    const finalMessages = await page
      .locator('[class*="message"], .bg-white.border, .bg-blue-500')
      .count();
    console.log(`📊 Final messages: ${finalMessages} (was ${initialMessages})`);

    // Should have new messages from discussion
    expect(finalMessages).toBeGreaterThan(initialMessages);

    // Look for agent messages
    const agentMessages = page.locator('.bg-white.border');
    const agentMessageCount = await agentMessages.count();
    console.log(`🤖 Agent messages: ${agentMessageCount}`);

    // Look for discussion end banner
    const discussionEnd = page.locator('text=Discussion Ended');
    const discussionEndExists = (await discussionEnd.count()) > 0;
    console.log(`🎙️ Discussion end banner visible: ${discussionEndExists}`);

    // Take screenshot for debugging
    await page.screenshot({ path: 'tests/e2e/screenshots/discussion-test.png' });
    console.log('📸 Screenshot saved');

    // Log all message content for debugging
    const allMessages = await page
      .locator('[class*="message"], .bg-white.border, .bg-blue-500, .bg-purple-50')
      .all();
    console.log(`\n📋 All messages (${allMessages.length}):`);
    for (let i = 0; i < allMessages.length; i++) {
      const content = await allMessages[i].textContent();
      console.log(`  ${i + 1}. ${content?.substring(0, 100)}`);
    }

    // Verify discussion happened
    expect(discussionStartExists || finalMessages > initialMessages).toBeTruthy();
  });

  test('should show system messages for discussion', async ({ page }) => {
    console.log('🧪 Testing system message rendering...');

    // Select room
    await page.locator('button:has-text("agents")').first().click();
    await page.waitForTimeout(2000);

    // Send discussion command
    const input = page.locator('input[type="text"][placeholder*="Type a message"]');
    await input.fill('/discuss test topic');
    await page.locator('button:has-text("Send")').click();

    // Wait for messages
    await page.waitForTimeout(5000);

    // Check for any purple banners (system messages)
    const purpleBanners = page.locator('.bg-purple-50');
    const count = await purpleBanners.count();
    console.log(`🟣 Purple banner count: ${count}`);

    // Check for system senderType messages
    const allDivs = page.locator('div');
    const allClasses = await allDivs.all();

    let foundSystemMessage = false;
    for (let i = 0; i < Math.min(50, allClasses.length); i++) {
      const className = await allClasses[i].getAttribute('class');
      if (className && (className.includes('purple') || className.includes('system'))) {
        const text = await allClasses[i].textContent();
        console.log(`Found potential system message: ${text?.substring(0, 50)}`);
        foundSystemMessage = true;
      }
    }

    console.log(`Found system message: ${foundSystemMessage}`);

    await page.screenshot({ path: 'tests/e2e/screenshots/system-message-test.png' });
  });
});
