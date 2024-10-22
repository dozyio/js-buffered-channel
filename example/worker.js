/* eslint-disable no-console */
// example/worker.js
import { BufferedChannel } from '../dist/buffered-channel.js' // Named import

const bufferSize = 4
let workerChannel = null

// Listen for the initial message to set up the channel
self.onmessage = (event) => {
  if (event.data.type === 'init' && event.data.port) {
    const port = event.data.port
    workerChannel = new BufferedChannel(port, bufferSize, 'worker')

    // Start handling messages
    handleMessages()
  }
}

async function handleMessages () {
  if (!workerChannel) return

  for await (const msg of workerChannel.receive) {
    if (msg === 'done') {
      console.log('Worker: Received termination signal.')
      break
    }

    console.log(`Worker Received: ${msg}`)

    // Process each message concurrently by calling a separate function
    processMessage(msg)
  }

  // Close the port after handling
  workerChannel.port.close()
}

/**
 * Processes a single message: simulates a delay and echoes it back.
 *
 * @param {string} msg - The message to process.
 */
async function processMessage (msg) {
  try {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 100)))

    // Echo the message back directly without using BufferedChannel.send()
    workerChannel.port.postMessage(`Echo: ${msg}`)
    console.log(`Worker Sent: Echo: ${msg}`)
  } catch (error) {
    console.error(`Worker Error Processing Message "${msg}":`, error)
  }
}
