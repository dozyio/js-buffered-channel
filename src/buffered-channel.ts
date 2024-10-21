// src/buffered-channel.ts

export default class BufferedChannel {
  private readonly port: MessagePort
  private readonly bufferSize: number
  private readonly receiveQueue: any[] = []
  private readonly receiveResolvers: Array<(result: IteratorResult<any>) => void> = []
  private readonly sendQueue: Array<{ message: any, resolve: any, reject: any }> = []
  private readonly sendResolvers: Array<() => void> = []
  private inFlight: number = 0

  constructor (port: MessagePort, bufferSize: number = 4) {
    this.port = port
    this.bufferSize = bufferSize

    // Initialize the port listener
    this.port.onmessage = (event) => {
      // console.log(`BufferedChannel: Received message "${event.data}"`);

      // Handle incoming messages
      this.enqueueReceive(event.data)

      // Handle the echo: resolve the first sendResolver
      if (this.sendResolvers.length > 0) {
        const resolve = this.sendResolvers.shift()
        if (resolve !== undefined) {
          resolve()
          this.inFlight--
        }
      }

      // Try to send next message from sendQueue
      this.trySendQueued()
    }

    // Handle port closure
    // this.port.onclose = () => {
    //   // console.log('BufferedChannel: Port closed.');
    //
    //   // Reject all pending receive promises
    //   this.receiveResolvers.forEach((resolve) =>
    //     resolve({ value: undefined, done: true })
    //   )
    //   this.receiveResolvers = []
    //
    //   // Resolve all pending send promises
    //   this.sendResolvers.forEach((resolve) => resolve())
    //   this.sendResolvers = []
    //
    //   // Reject all queued sends
    //   while (this.sendQueue.length > 0) {
    //     const { reject } = this.sendQueue.shift()
    //     reject(new Error('Port closed'))
    //   }
    // }
  }

  // Internal method to enqueue received messages
  private enqueueReceive (message: any): void {
    if (this.receiveResolvers.length > 0) {
      const resolve = this.receiveResolvers.shift()
      if (resolve !== undefined) {
        resolve({ value: message, done: false })
      }
    } else {
      this.receiveQueue.push(message)
    }
  }

  // Async iterator for receiving messages
  get receive (): AsyncIterableIterator<any> {
    const self = this
    return {
      [Symbol.asyncIterator] () {
        return this
      },
      async next () {
        if (self.receiveQueue.length > 0) {
          const value = self.receiveQueue.shift()
          return Promise.resolve({ value, done: false })
        }
        return new Promise<IteratorResult<any>>((resolve) => {
          self.receiveResolvers.push(resolve)
        })
      }
    }
  }

  // Method to send messages with backpressure
  async send (message: any): Promise<void> {
    if (this.sendResolvers.length < this.bufferSize) {
      this.inFlight++
      // console.log(`BufferedChannel: Sending message "${message}" immediately. In-flight: ${this.sendResolvers.length + 1}, Buffer size: ${this.bufferSize}`);

      // Send the message immediately
      this.port.postMessage(message)

      // Create a Promise that will resolve when echo is received
      return new Promise<void>((resolve, _reject) => {
        this.sendResolvers.push(resolve)
      })
    } else {
      // console.log(`BufferedChannel: Buffer full. Enqueuing message "${message}". Queue length: ${this.sendQueue.length + 1}`);

      // Buffer is full, enqueue the message
      return new Promise<void>((resolve, reject) => {
        this.sendQueue.push({ message, resolve, reject })
      })
    }
  }

  // Method to handle sending queued messages when space is available
  private trySendQueued (): void {
    while (
      this.sendResolvers.length < this.bufferSize &&
      this.sendQueue.length > 0
    ) {
      const msg = this.sendQueue.shift()
      if (msg === undefined) {
        return
      }

      try {
        this.port.postMessage(msg.message)
        this.inFlight++
        // console.log(`BufferedChannel: Sent enqueued message "${message}". In-flight: ${this.sendResolvers.length + 1}`);
        this.sendResolvers.push(msg.resolve)
      } catch (error) {
        // console.error(`BufferedChannel: Error sending message "${message}":`, error);
        msg.reject(error)
      }
    }
  }

  // Initiate flow control by attempting to send any queued messages
  initSendFlow (): void {
    this.trySendQueued()
  }
}
