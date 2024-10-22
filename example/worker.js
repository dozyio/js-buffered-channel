/* eslint-disable no-console */
// example/worker.js

import { BufferedChannel } from '../dist/buffered-channel.js' // Adjust the import path as necessary

const bufferSize = 4
let workerChannel = null

// Listen for the initial message to set up the channel
self.onmessage = (event) => {
  switch (event.data.type) {
    case 'init':
      if (event.data.port) {
        const port = event.data.port
        workerChannel = new BufferedChannel(port, bufferSize, { debug: false, name: 'worker' })

        // Start handling messages
        handleMessages()
      } else {
        throw new Error('Port is missing in init message.')
      }
      break

    case 'terminate':
      console.log('Worker: Received termination signal.')
      workerChannel.port.close()
      self.close() // Terminate the worker
      break

    default:
      console.error('Worker: Unknown message type:', event.data.type)
  }
}

async function handleMessages () {
  if (!workerChannel) return

  for await (const msg of workerChannel.receive) {
    // Each `msg` is expected to be a DataMessage<ArrayBuffer>
    if (msg && typeof msg.id === 'string' && msg.type === 'data') {
      // console.log(`Worker Received: ID=${msg.id}, Data=ArrayBuffer(${msg.data.byteLength} bytes)`)
      // Process each message concurrently
      processMessage(msg)
    } else {
      console.warn('Worker: Received unknown or malformed message.')
    }
  }

  // Close the port after handling all messages
  workerChannel.port.close()
}

/**
 * Processes a single message: simulates a delay, modifies the ArrayBuffer, and sends an acknowledgment.
 *
 * @param {DataMessage<ArrayBuffer>} msg - The message to process.
 */
async function processMessage (msg) {
  try {
    // Simulate processing delay
    // await new Promise(resolve => setTimeout(resolve, 1000))

    // Example processing: modify the buffer
    // const view = new Uint8Array(msg.data)
    // view[0] = view[0] + 1 // Increment the first byte as an example

    // Create acknowledgment with processed data
    const ack = {
      id: msg.id,
      type: 'ack',
      status: 'ack'
    }

    // Send acknowledgment
    await workerChannel.sendAck(ack)
    // console.log(`Worker Sent Ack: ID=${ack.id}, Status=${ack.status}`)
  } catch (error) {
    console.error(`Worker Error Processing Message ID=${msg.id}:`, error)

    // Send error acknowledgment
    const ack = {
      id: msg.id,
      type: 'ack',
      status: 'error',
      data: `Error processing ArrayBuffer: ${error.message}`
    }

    await workerChannel.sendAck(ack)
  }
}
