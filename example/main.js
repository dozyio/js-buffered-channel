/* eslint-disable no-console */
// example/main.js

import { BufferedChannel } from '../dist/buffered-channel.js' // Named import

// Create a Web Worker with type 'module' using new URL for proper bundling
const worker = new Worker(new URL('worker.js', import.meta.url), { type: 'module' })

const messageChannel = new MessageChannel()
const bufferSize = 4
const mainChannel = new BufferedChannel(messageChannel.port1, bufferSize, 'main')

// Send the other port to the worker
worker.postMessage({ type: 'init', port: messageChannel.port2 }, [messageChannel.port2])

/**
 * Async generator that yields messages with a simulated delay.
 *
 * @param {number} count - The total number of messages to generate.
 */
async function * generateMessages (count) {
  for (let i = 1; i <= count; i++) {
    // Simulate asynchronous message production delay
    yield `Message ${i}`
  }
}

// Define the send function
const sendFunc = async (msg) => {
  await mainChannel.send(msg)
  console.log(`Main Sent: ${msg}`)
}

/**
 * Sends messages from an async iterator with controlled concurrency.
 *
 * @param {AsyncIterable<string>} messageIterator - The async iterator providing messages.
 * @param {Function} sendFunc - The asynchronous send function.
 * @param {number} bufferSize - The maximum number of concurrent send operations.
 */
async function sendMessages (messageIterator, sendFunc, bufferSize) {
  const activePromises = new Set()

  for await (const msg of messageIterator) {
    // Start sending the message and add the promise to the active set
    const sendPromise = sendFunc(msg)
      .catch(error => {
        console.error(`Error sending ${msg}:`, error)
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

// Start sending all messages, leveraging the semaphore for concurrency control
(async () => {
  const messageIterator = generateMessages(1_000) // Generate messages
  await sendMessages(messageIterator, sendFunc, bufferSize)
  console.log('All messages have been sent.')

  // Optional: Send termination signal to the worker
  worker.postMessage({ type: 'terminate' })
})()

// Receiving messages
; (async () => {
  for await (const msg of mainChannel.receive) {
    console.log(`Main Received: ${msg}`)
  }
})()
