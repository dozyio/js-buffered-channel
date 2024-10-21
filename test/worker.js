// test/worker.js
import { BufferedChannel } from '../dist/buffered-channel.js'

let workerChannel = null

// Listen for the initial message to set up the channel
self.onmessage = (event) => {
  if (event.data.type === 'init' && event.data.port) {
    const port = event.data.port
    workerChannel = new BufferedChannel(port, 4)
    workerChannel.initSendFlow()

    // Start handling messages
    handleMessages()
  }
}

async function handleMessages () {
  if (!workerChannel) return

  for await (const msg of workerChannel.receive) {
    if (msg === 'done') {
      // eslint-disable-next-line no-console
      console.log('Worker: Received termination signal.')
      break
    }
    // Echo the message back
    await workerChannel.send(`Echo: ${msg}`)
  }

  // Close the port after handling
  workerChannel.port.close()
}
