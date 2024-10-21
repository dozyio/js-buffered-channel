// worker.js
import { BufferedChannel } from '../dist/buffered-channel.js'

let bufferedChannel

const bufferSize = 4
const concurrentHandlers = bufferSize

// Listen for the initial message to set up the channel
self.onmessage = (event) => {
  // eslint-disable-next-line no-console
  console.log('Worker: Received initial event:', event)
  if (event.data.type === 'init') {
    bufferedChannel = new BufferedChannel(event.data.port, bufferSize)
    bufferedChannel.initSendFlow()
    handleMessages()
  }
}

// Function to handle incoming messages concurrently
async function handleMessages () {
  try {
    // const concurrentHandlers = bufferedChannel.bufferSize;
    const handlerPromises = []

    for (let i = 0; i < concurrentHandlers; i++) {
      handlerPromises.push(messageHandler(i + 1))
    }

    // Wait for all handlers to complete
    await Promise.all(handlerPromises)

    // Close the port after all handlers are done
    bufferedChannel.port.close()
    // eslint-disable-next-line no-console
    console.log('Worker: Terminated gracefully.')
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Worker: Error handling messages:', error)
  }
}

// Individual message handler
async function messageHandler (handlerId) {
  try {
    for await (const msg of bufferedChannel.receive) {
      if (msg === 'done') {
        // eslint-disable-next-line no-console
        console.log(`Worker: Handler ${handlerId} received termination signal.`)
        break // Exit the loop to terminate gracefully
      }

      // eslint-disable-next-line no-console
      console.log(`Worker: Handler ${handlerId} received "${msg}"`)

      // Simulate processing time (random delay between 0-10 ms)
      // await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 100)));

      // Echo the message back
      await bufferedChannel.send(`Echo: ${msg}`)
      // eslint-disable-next-line no-console
      console.log(`Worker: Handler ${handlerId} sent "Echo: ${msg}"`)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Worker: Handler ${handlerId} encountered an error:`, error)
  }
}
