/* eslint-disable no-console */
// src/buffered-channel.ts

import Semaphore from './semaphore'

export class BufferedChannel<T = any> {
  private readonly port: MessagePort
  private readonly semaphore: Semaphore
  private readonly receiveQueue: T[] = []
  private readonly receiveResolvers: Array<(result: IteratorResult<T>) => void> = []
  private readonly sendResolvers: Array<() => void> = []

  constructor (port: MessagePort, bufferSize: number = 1, what: string) {
    this.port = port
    this.semaphore = new Semaphore(bufferSize, what)

    // Initialize the port listener
    this.port.onmessage = (event) => {
      this.enqueueReceive(event.data)

      // Handle the acknowledgment: resolve the first sendResolver
      if (this.sendResolvers.length > 0) {
        const resolve = this.sendResolvers.shift()
        if (resolve !== undefined) {
          resolve()
          this.semaphore.release()
        }
      }
    }
  }

  // Internal method to enqueue received messages
  private enqueueReceive (message: T): void {
    console.debug(`BufferedChannel (${this.semaphore.what}): Enqueuing received message:`, message)
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
  get receive (): AsyncIterableIterator<T> {
    const self = this
    return {
      [Symbol.asyncIterator] () {
        return this
      },
      async next (): Promise<IteratorResult<T>> {
        if (self.receiveQueue.length > 0) {
          const value = self.receiveQueue.shift()!
          return { value, done: false }
        }
        return new Promise<IteratorResult<T>>((resolve) => {
          self.receiveResolvers.push(resolve)
        })
      }
    }
  }

  /**
   * Sends a message through the channel with backpressure control.
   * Waits for a permit before sending and ensures that the buffer size is respected.
   *
   * @param message - The message to send.
   * @param transfer - Transferable objects, if any.
   * @param timeout - Optional timeout in milliseconds.
   */
  async send (message: T, transfer: Transferable[] = [], timeout: number = 5000): Promise<void> {
    // Acquire a permit before sending
    console.debug(`BufferedChannel (${this.semaphore.what}): Attempting to acquire a permit for sending: ${message}`)
    await this.semaphore.acquire()
    console.debug(`BufferedChannel (${this.semaphore.what}): Permit acquired for sending: ${message}`)

    // Send the message immediately
    this.port.postMessage(message, transfer)
    console.log(`BufferedChannel (${this.semaphore.what}): Message sent: ${message}`)

    // Create a Promise that will resolve when echo is received or reject on timeout
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        console.error(`BufferedChannel (${this.semaphore.what}): Send operation timed out for message: ${message}`)
        // Release the semaphore to avoid deadlock
        this.semaphore.release()
        reject(new Error('Send operation timed out'))
      }, timeout)

      // Push the resolver to be called upon acknowledgment
      this.sendResolvers.push(() => {
        clearTimeout(timer)
        console.debug(`BufferedChannel (${this.semaphore.what}): Acknowledgment received for message: ${message}`)
        resolve()
      })
    })
  }
}
