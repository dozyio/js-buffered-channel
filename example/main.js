// main.js
import { BufferedChannel } from '../dist/buffered-channel.js'

// Function to create and initialize the buffered channel
function createBufferedChannel (worker, bufferSize = 4) {
  const channel = new MessageChannel()
  worker.postMessage({ type: 'init', port: channel.port1 }, [channel.port1])

  const bufferedChannel = new BufferedChannel(channel.port2, bufferSize)
  bufferedChannel.initSendFlow()

  return bufferedChannel
}

// Initialize the worker as a module
const worker = new Worker('worker.js', { type: 'module' })

// Create the buffered channel with a buffer size
const bufferSize = 4 // Ensure this matches the worker's bufferSize
const channel = createBufferedChannel(worker, bufferSize)

// Total number of messages to send
const totalMessages = 1_000

// Variable to track the number of received messages
let totalReceived = 0

// Current message index
let current = 0

// Function to get the next message index atomically
function getNextMessage () {
  if (current >= totalMessages) {
    return null
  }
  const msg = `Message ${current} from main thread`
  current++
  return msg
}

// Function to manage concurrent sends up to bufferSize
async function sendMessagesConcurrently () {
  async function send (senderId) {
    while (true) {
      const msg = getNextMessage()
      if (!msg) break

      try {
        await channel.send(msg)
        // eslint-disable-next-line no-console
        console.log(`Main sent: ${msg} by sender ${senderId}`);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Error sending ${msg}:`, error)
      }
    }
  }

  const sendPromises = []
  for (let i = 0; i < bufferSize; i++) {
    sendPromises.push(send(i + 1))
  }

  await Promise.all(sendPromises)
}

// Function to gracefully terminate the worker
async function terminateWorker () {
  try {
    // Send a 'done' message to signal the worker to terminate
    await channel.send('done')
    // eslint-disable-next-line no-console
    console.log('Sent termination signal to worker.');

    // Close the message port
    channel.port.close()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error terminating worker:', error)
  }
}

const tstart = Date.now()

// Sending messages to the worker with backpressure
sendMessagesConcurrently().then(() => {
  // eslint-disable-next-line no-console
  console.log('All messages sent.');
});

// Receiving messages from the worker
(async () => {
  try {
    for await (const msg of channel.receive) {
      if (msg.startsWith('Echo: ')) {
        // eslint-disable-next-line no-console
        console.log('Main received:', msg);
        totalReceived++

        if (totalReceived === totalMessages) {
          // eslint-disable-next-line no-console
          console.log('All messages received.');
          const tend = Date.now()
          document.getElementById('time').innerText = `${tend - tstart} ms`
          await terminateWorker()
          worker.terminate() // Ensure worker is terminated
        }
      } else {
        // eslint-disable-next-line no-console
        console.warn('Main received unexpected message:', msg)
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error receiving messages:', error)
  }
})()
