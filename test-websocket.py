from playwright.sync_api import sync_playwright
import time

def test_websocket_messages():
    """Test WebSocket real-time message updates"""
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Capture console logs
        console_logs = []
        page.on('console', lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        
        # Navigate to frontend
        print("🌐 Navigating to http://localhost:3000...")
        page.goto('http://localhost:3000')
        
        # Wait for page to load
        print("⏳ Waiting for page load...")
        page.wait_for_load_state('networkidle')
        time.sleep(2)  # Extra wait for React hydration
        
        # Show console logs
        print("\n📋 Console logs after page load:")
        for log in console_logs[-20:]:
            print(f"  {log}")
        
        # Check if room is selected
        print("\n🔍 Checking for selected room...")
        room_selector = page.locator('.bg-blue-100, .bg-blue-50, [data-room]')
        if room_selector.count() > 0:
            print("✅ Room found in sidebar")
        else:
            print("❌ No room selected")
        
        # Find message input
        print("\n🔍 Looking for message input...")
        input_field = page.locator('input[placeholder*="message"], input[type="text"], textarea').first
        if input_field.count() > 0:
            print("✅ Input field found")
            
            # Send a test message
            print("\n✉️ Sending test message...")
            input_field.fill('Playwright test message')
            
            # Find and click send button
            send_button = page.locator('button:has-text("Send"), button[type="submit"]').first
            if send_button.count() > 0:
                send_button.click()
                print("✅ Send button clicked")
                
                # Wait for message to appear
                time.sleep(2)
                
                # Check if message appears in chat
                print("\n🔍 Checking for sent message in chat...")
                chat_messages = page.locator('[class*="message"], [class*="bubble"], .flex.gap-2')
                print(f"   Found {chat_messages.count()} message elements")
                
                # Get latest console logs
                print("\n📋 Console logs after sending:")
                for log in console_logs[-30:]:
                    if 'WebSocket' in log or 'message' in log.lower() or 'room' in log.lower():
                        print(f"  {log}")
                
                # Take screenshot
                page.screenshot(path='/tmp/chat-test.png', full_page=True)
                print("\n📸 Screenshot saved to /tmp/chat-test.png")
            else:
                print("❌ Send button not found")
        else:
            print("❌ Input field not found")
        
        browser.close()
        print("\n✅ Test complete!")

if __name__ == '__main__':
    test_websocket_messages()
