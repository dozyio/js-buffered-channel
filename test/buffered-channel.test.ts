// test/playwright/buffered-channel.test.ts
import { test, expect } from '@playwright/test'

test.describe('BufferedChannel E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/test/index.html')
  })

  test('should send and receive messages correctly', async ({ page }) => {
    // Click the 'Start Test' button to initiate communication
    await page.click('#startTest')

    // Define expected messages
    const expectedSentMessages = ['Message 1', 'Message 2', 'Message 3', 'Message 4', 'Message 5']
    const expectedReceivedMessages = expectedSentMessages.map(msg => `Echo: ${msg}`)

    // Collect logs from the page
    const logs: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'log') {
        logs.push(msg.text())
      }
    })

    // Wait until all messages are received and termination log is present
    await page.waitForFunction(
      (expectedCount) => {
        const logDiv = document.getElementById('log')
        return logDiv && logDiv.querySelectorAll('p').length >= expectedCount
      },
      expectedSentMessages.length * 2 + 1, // Each sent message has a received message and one termination log
      { timeout: 10000 }
    )

    // Verify sent messages
    for (const sentMsg of expectedSentMessages) {
      expect(logs).toContain(`Sent: ${sentMsg}`)
    }

    // Verify received messages
    for (const receivedMsg of expectedReceivedMessages) {
      expect(logs).toContain(`Received: ${receivedMsg}`)
    }

    // Verify termination log
    expect(logs).toContain('All messages received. Terminating worker.')
  })
})
