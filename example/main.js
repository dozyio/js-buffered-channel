/* eslint-disable no-console */
// example/main.js

import { BufferedChannel } from '../dist/buffered-channel.js' // Adjust the import path as necessary

let messageCounter = 0
// Utility function to generate unique IDs
function generateUniqueId () {
  return `msg-${++messageCounter}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Create a Web Worker with type 'module' using new URL for proper bundling
const worker = new Worker(new URL('worker.js', import.meta.url), { type: 'module' })

const messageChannel = new MessageChannel()
const bufferSize = 4
const mainChannel = new BufferedChannel(
  messageChannel.port1,
  bufferSize,
  { debug: false, name: 'main' }
)

// Send the other port to the worker
worker.postMessage({ type: 'init', port: messageChannel.port2 }, [messageChannel.port2])

/**
 * Async generator that yields data with a simulated delay.
 *
 * @param {number} count - The total number of data items to generate.
 */
async function * generateData (count) {
  for (let i = 1; i <= count; i++) {
    // Create transferable data (e.g., ArrayBuffer)
    const buffer = new ArrayBuffer(1024 * 1024)
    const view = new Uint8Array(buffer)
    view.fill(i) // Populate the buffer with sample data

    yield buffer
  }
}

/**
 * Sends data using BufferedChannel with controlled concurrency.
 *
 * @param {AsyncIterable<ArrayBuffer>} dataIterator - The async iterator providing data.
 * @param {number} bufferSize - The maximum number of concurrent send operations.
 */
async function sendData (dataIterator, bufferSize) {
  const activePromises = new Set()

  for await (const buffer of dataIterator) {
    // Start sending the data and add the promise to the active set
    const sendPromise = sendMessage(buffer)
      .catch(error => {
        console.error('Error sending data:', error)
      })
      .finally(() => {
        // Remove the promise from the active set once it's settled
        activePromises.delete(sendPromise)
      })

    activePromises.add(sendPromise)

    // If we've reached the buffer size, wait for any promise to settle
    if (activePromises.size >= bufferSize) {
      await Promise.race(activePromises)
    }
  }

  // Await all remaining active send operations
  await Promise.all(activePromises)
}

/**
 * Sends a single data message through BufferedChannel.
 *
 * @param {ArrayBuffer} buffer - The data to send.
 */
const sendMessage = async (buffer) => {
  const id = generateUniqueId()
  const message = {
    id,
    type: 'data',
    data: buffer
  }

  try {
    await mainChannel.sendData(message, [buffer]) // Transfer the buffer with a 5-second timeout
    // console.log(`Main Sent: ID=${id}, Data=ArrayBuffer(${buffer.byteLength} bytes)`)
  } catch (error) {
    console.error(`Failed to send message ID=${id}:`, error)
  }
}

// Start sending all data
(async () => {
  const itemCount = 100_000
  const startTime = Date.now()
  const dataIterator = generateData(itemCount)
  await sendData(dataIterator, bufferSize)
  console.log('All data has been sent.')

  // Optionally, send termination signal to the worker
  worker.postMessage({ type: 'terminate', data: 'terminate' })
  // console.log('Worker has been terminated.')
  const endTime = Date.now()
  document.getElementById('time').innerText = `Time: ${endTime - startTime} ms - items: ${itemCount}`
})()
