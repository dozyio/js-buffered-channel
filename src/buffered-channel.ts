/* eslint-disable no-console */
// src/buffered-channel.ts

import Semaphore from './semaphore'

export interface BufferedChannelOpts {
  /**
   * Whether to enable debug logging.
   */
  debug?: boolean

  /**
   * The name of the channel, used when logging debug messages
   */
  name?: string
}

// Define a base message interface with a 'type' field
export interface BaseMessage {
  id: string
  type: 'data' | 'ack'
}

// Data messages sent from sender to receiver
export interface DataMessage<T = any> extends BaseMessage {
  type: 'data'
  data: T
}

// Acknowledgment messages sent from receiver to sender
export interface AckMessage extends BaseMessage {
  type: 'ack'
  status: 'ack' | 'error'
  data: any
}

export type IncomingMessage<T = any> = DataMessage<T> | AckMessage

export class BufferedChannel<T = any> {
  private readonly port: MessagePort
  private readonly semaphore: Semaphore
  private readonly receiveQueue: Array<IncomingMessage<T>> = []
  private readonly receiveResolvers: Array<(result: IteratorResult<DataMessage<T>, any>) => void> = []
  private readonly sendResolvers = new Map<string, {
    resolve(): void
    reject(error: any): void
    timeout?: number
  }>()

  private readonly debug: boolean
  private readonly name: string

  /**
   * Creates a new BufferedChannel instance.
   *
   * @param port - The MessagePort to use for communication.
   * @param bufferSize - The maximum number of concurrent send operations.
   * @param opts - Optional configuration options.
   */
  constructor (port: MessagePort, bufferSize: number = 1, opts: BufferedChannelOpts = {}) {
    this.debug = opts.debug ?? false
    this.name = opts.name ?? ''
    this.port = port

    this.semaphore = new Semaphore(bufferSize, { debug: this.debug, name: `${this.name}-semaphore` })

    // Initialize the port listener
    this.port.onmessage = (event) => {
      this.handleIncoming(event.data)
    }
  }

  // Internal method to handle incoming messages (acknowledgments or data)
  private handleIncoming (message: IncomingMessage<T>): void {
    if (this.debug) {
      console.debug(`BufferedChannel (${this.name}): Received message:`, message)
    }

    if (message.type === 'ack') {
      const ack = message
      const pending = this.sendResolvers.get(ack.id)
      if (pending !== undefined) {
        if (ack.status === 'ack') {
          pending.resolve()
        } else {
          // Ensure rejection reason is an Error object
          const error = ack.data instanceof Error ? ack.data : new Error(String(ack.data))
          pending.reject(error)
        }
        // Clear timeout if set
        if (pending.timeout !== undefined) {
          clearTimeout(pending.timeout)
        }
        this.sendResolvers.delete(ack.id)
        // Release the semaphore permit after acknowledgment
        this.semaphore.release()
      } else {
        console.warn(`BufferedChannel (${this.name}): Received acknowledgment for unknown message ID ${ack.id}`)
      }
    } else if (message.type === 'data') {
      const dataMsg = message
      this.enqueueReceive(dataMsg)
    } else {
      console.warn(`BufferedChannel (${this.name}): Received message with unknown type`)
    }
  }

  // Internal method to enqueue received data messages
  private enqueueReceive (message: DataMessage<T>): void {
    if (this.debug) {
      console.debug(`BufferedChannel (${this.name}): Enqueuing received message:`, message)
    }

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
  get receive (): AsyncIterableIterator<DataMessage<T>> {
    const self = this
    return {
      [Symbol.asyncIterator] () {
        return this
      },
      async next (): Promise<IteratorResult<DataMessage<T>>> {
        if (self.receiveQueue.length > 0) {
          const value = self.receiveQueue.shift()
          if (value !== undefined) {
            return { value: value as DataMessage<T>, done: false }
          }
          throw new Error('Queue was empty despite length > 0')
        }
        return new Promise<IteratorResult<DataMessage<T>>>((resolve) => {
          self.receiveResolvers.push(resolve)
        })
      }
    }
  }

  /**
   * Sends a data message through the channel with backpressure control.
   * Waits for a permit before sending and ensures that the buffer size is respected.
   *
   * @param message - The data message to send.
   * @param transfer - Transferable objects, if any.
   * @param timeout - Optional timeout in milliseconds.
   */
  async sendData (
    message: DataMessage<T>,
    transfer: Transferable[] = [],
    timeout?: number | null
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let timer: number | undefined

      // Set up the timeout only if timeout is a positive number
      if (typeof timeout === 'number' && timeout > 0) {
        timer = window.setTimeout(() => {
          console.error(
            `BufferedChannel (${this.name}): Send operation timed out for message ID ${message.id}:`,
            message.data
          )
          // Release the semaphore to avoid deadlock
          this.semaphore.release()
          this.sendResolvers.delete(message.id)
          reject(new Error(`Send operation timed out for message ID ${message.id}`))
        }, timeout)
      }

      // Store the resolver and rejector in the map
      this.sendResolvers.set(message.id, { resolve, reject, timeout: timer })

      // Acquire a permit before sending
      if (this.debug) {
        console.debug(
          `BufferedChannel (${this.name}): Attempting to acquire a permit for sending message ID ${message.id}`
        )
      }

      this.semaphore
        .acquire()
        .then(() => {
          if (this.debug) {
            console.debug(
              `BufferedChannel (${this.name}): Permit acquired for sending message ID ${message.id}`
            )
          }

          // Send the message
          this.port.postMessage(message, transfer)
          if (this.debug) {
            console.log(
              `BufferedChannel (${this.name}): Data message sent with ID ${message.id}:`,
              message.data
            )
          }
        })
        .catch((error) => {
          // If an error occurs while acquiring the semaphore, clean up
          if (timer !== undefined) {
            clearTimeout(timer)
          }
          this.sendResolvers.delete(message.id)
          // Ensure rejection reason is an Error object
          const err = error instanceof Error ? error : new Error(String(error))
          reject(err)
        })
    })
  }

  /**
   * Sends an acknowledgment message through the channel.
   * Does not wait for an acknowledgment for the ack.
   *
   * @param ack - The acknowledgment message to send.
   * @param transfer - Transferable objects, if any.
   */
  async sendAck (ack: AckMessage, transfer: Transferable[] = []): Promise<void> {
    try {
      this.port.postMessage(ack, transfer)
      if (this.debug) {
        console.log(`BufferedChannel (${this.name}): Ack message sent with ID ${ack.id}:`, ack.data)
      }
    } catch (error) {
      console.error(`BufferedChannel (${this.name}): Failed to send ack for message ID ${ack.id}:`, error)
    }
  }
}
