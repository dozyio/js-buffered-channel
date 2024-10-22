// test/buffered-channel.test.ts
import { test, expect } from '@playwright/test'

test.describe('BufferedChannel E2E Tests with IDs and Transferables', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/test/index.html') // Adjust the URL based on your server setup
  })

  test('should send and receive messages correctly with IDs and acknowledgments', async ({ page }) => {
    // Click the 'Start Test' button to initiate communication
    await page.click('#startTest')

    // Define expected acknowledgments
    const expectedAcknowledgments = [
      'Processed ArrayBuffer with first byte: 2',
      'Processed ArrayBuffer with first byte: 3',
      'Processed ArrayBuffer with first byte: 4',
      'Processed ArrayBuffer with first byte: 5',
      'Processed ArrayBuffer with first byte: 6'
    ]

    // Collect logs from the page
    const logs: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'log') {
        logs.push(msg.text())
      }
    })

    // Wait until all acknowledgments are received and termination log is present
    await page.waitForFunction(
      (expectedAckCount) => {
        const logDiv = document.getElementById('log')
        if (!logDiv) return false
        const ackMessages = Array.from(logDiv.querySelectorAll('p')).filter(p => p.textContent?.includes('Processed ArrayBuffer with first byte:')).length
        const terminationLog = Array.from(logDiv.querySelectorAll('p')).some(p => p.textContent?.includes('Worker has been terminated.'))
        return ackMessages >= expectedAckCount && terminationLog
      },
      expectedAcknowledgments.length,
      { timeout: 20000 } // Increased timeout to accommodate delays
    )

    // Verify received acknowledgments
    for (const ackMsg of expectedAcknowledgments) {
      const ackLog = logs.find(log => log.includes(ackMsg))
      expect(ackLog).toBeTruthy()
      expect(ackLog).toContain(ackMsg)
    }

    // Verify termination log
    const terminationLog = logs.find(log => log.includes('Worker has been terminated.'))
    expect(terminationLog).toBeTruthy()
  })
})
