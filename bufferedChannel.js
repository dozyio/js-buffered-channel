// bufferedChannel.js

export default class BufferedChannel {
  constructor(port, bufferSize = 10) {
    this.port = port;
    this.bufferSize = bufferSize;

    // Queues for incoming messages
    this.receiveQueue = [];
    this.receiveResolvers = [];

    // Queues for outgoing messages
    this.sendQueue = [];
    this.sendResolvers = [];

    // Initialize the port listener
    this.port.onmessage = (event) => {
      // console.log(`BufferedChannel: Received message "${event.data}"`);
      
      // Handle incoming messages
      this._enqueueReceive(event.data);

      // Handle the echo: resolve the first sendResolver
      if (this.sendResolvers.length > 0) {
        const resolve = this.sendResolvers.shift();
        resolve();
      }

      // Try to send next message from sendQueue
      this._trySendQueued();
    };

    // Handle port closure
    this.port.onclose = () => {
      // console.log('BufferedChannel: Port closed.');

      // Reject all pending receive promises
      this.receiveResolvers.forEach((resolve) =>
        resolve({ value: undefined, done: true })
      );
      this.receiveResolvers = [];

      // Resolve all pending send promises
      this.sendResolvers.forEach((resolve) => resolve());
      this.sendResolvers = [];

      // Reject all queued sends
      while (this.sendQueue.length > 0) {
        const { reject } = this.sendQueue.shift();
        reject(new Error('Port closed'));
      }
    };
  }

  // Internal method to enqueue received messages
  _enqueueReceive(message) {
    if (this.receiveResolvers.length > 0) {
      const resolve = this.receiveResolvers.shift();
      resolve({ value: message, done: false });
    } else {
      this.receiveQueue.push(message);
    }
  }

  // Async iterator for receiving messages
  get receive() {
    const self = this;
    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      next() {
        if (self.receiveQueue.length > 0) {
          const value = self.receiveQueue.shift();
          return Promise.resolve({ value, done: false });
        }
        return new Promise((resolve) => {
          self.receiveResolvers.push(resolve);
        });
      }
    };
  }

  // Method to send messages with backpressure
  send(message) {
    if (this.sendResolvers.length < this.bufferSize) {
      // console.log(`BufferedChannel: Sending message "${message}" immediately. In-flight: ${this.sendResolvers.length + 1}, Buffer size: ${this.bufferSize}`);

      // Send the message immediately
      this.port.postMessage(message);

      // Create a Promise that will resolve when echo is received
      return new Promise((resolve, reject) => {
        this.sendResolvers.push(resolve);
      });
    } else {
      // console.log(`BufferedChannel: Buffer full. Enqueuing message "${message}". Queue length: ${this.sendQueue.length + 1}`);

      // Buffer is full, enqueue the message
      return new Promise((resolve, reject) => {
        this.sendQueue.push({ message, resolve, reject });
      });
    }
  }

  // Method to handle sending queued messages when space is available
  _trySendQueued() {
    while (
      this.sendResolvers.length < this.bufferSize &&
      this.sendQueue.length > 0
    ) {
      const { message, resolve, reject } = this.sendQueue.shift();
      try {
        this.port.postMessage(message);
        // console.log(`BufferedChannel: Sent enqueued message "${message}". In-flight: ${this.sendResolvers.length + 1}`);
        this.sendResolvers.push(resolve);
      } catch (error) {
        // console.error(`BufferedChannel: Error sending message "${message}":`, error);
        reject(error);
      }
    }
  }

  // Initiate flow control by attempting to send any queued messages
  initSendFlow() {
    // Initially attempt to send any queued messages
    this._trySendQueued();
  }
}
