/* eslint-disable max-nested-callbacks */
// test/unit/buffered-channel.spec.ts

import { MessageChannel } from 'worker_threads'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BufferedChannel, type DataMessage, type AckMessage } from '../../src/buffered-channel'
import { Semaphore } from '../../src/semaphore'
import { type MessagePortLike } from '../../src/types'

describe('BufferedChannel', () => {
  let mainChannel: BufferedChannel<any>
  let workerChannel: BufferedChannel<any>
  let mainPort: MessagePortLike
  let workerPort: MessagePortLike

  let messageCounter: number

  // Helper function to generate unique IDs
  function generateUniqueId (): string {
    return `msg-${++messageCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }

  beforeEach(() => {
    // Reset message counter before each test
    messageCounter = 0

    // Create a MessageChannel for communication between main and worker
    const messageChannel = new MessageChannel()
    mainPort = messageChannel.port1 as unknown as MessagePortLike
    workerPort = messageChannel.port2 as unknown as MessagePortLike

    // Initialize BufferedChannel instances for main and worker
    mainChannel = new BufferedChannel<any>(
      mainPort,
      2, // bufferSize
      { debug: false, name: 'main', throwOnError: false }
    )

    workerChannel = new BufferedChannel<any>(
      workerPort,
      2, // bufferSize
      { debug: false, name: 'worker', throwOnError: false }
    )
  })

  it('should initialize correctly', () => {
    // @ts-expect-error: accessing internal properties for testing
    expect(mainChannel.semaphore).toBeInstanceOf(Semaphore)
    expect(mainChannel.getSentMessagesCount).toBe(0)
    expect(mainChannel.getReceivedAcksCount).toBe(0)
    expect(mainChannel.getTotalLatency).toBe(0)
    expect(mainChannel.getErrorCount).toBe(0)
  })

  it('should send data and receive acknowledgment successfully without transferable', async () => {
    const dataBuffer = 'test' // new ArrayBuffer(8)
    const dataMessage: DataMessage<any> = {
      id: generateUniqueId(),
      type: 'data',
      data: dataBuffer
    }

    // Listen for data on the worker channel
    const workerReceivePromise = (async () => {
      // eslint-disable-next-line no-unreachable-loop
      for await (const msg of workerChannel.receive) {
        expect(msg.id).toBe(dataMessage.id)
        expect(msg.type).toBe('data')
        // expect(msg.data).toBe(dataBuffer)

        // Send acknowledgment
        const ack: AckMessage = {
          id: msg.id,
          type: 'ack',
          status: 'ack',
          data: 'ok'
        }
        await workerChannel.sendAck(ack)
        break
      }
    })()

    // Send data from main channel
    const sendPromise = mainChannel.sendData(dataMessage)

    // Await both sending and receiving
    await Promise.all([sendPromise, workerReceivePromise])

    // Verify internal counts
    expect(mainChannel.getSentMessagesCount).toBe(1)
    expect(mainChannel.getReceivedAcksCount).toBe(1)
    expect(mainChannel.getErrorCount).toBe(0)
  })

  it('should send data and receive acknowledgment successfully with transferable', async () => {
    const dataBuffer = new ArrayBuffer(8)
    const dataMessage: DataMessage<any> = {
      id: generateUniqueId(),
      type: 'data',
      data: dataBuffer
    }

    // Listen for data on the worker channel
    const workerReceivePromise = (async () => {
      // eslint-disable-next-line no-unreachable-loop
      for await (const msg of workerChannel.receive) {
        expect(msg.id).toBe(dataMessage.id)
        expect(msg.type).toBe('data')
        // expect(msg.data).toBe(dataBuffer)

        // Send acknowledgment
        const ack: AckMessage = {
          id: msg.id,
          type: 'ack',
          status: 'ack',
          data: 'ok'
        }
        await workerChannel.sendAck(ack)
        break
      }
    })()

    // Send data from main channel
    const sendPromise = mainChannel.sendData(dataMessage, [dataBuffer])

    // Await both sending and receiving
    await Promise.all([sendPromise, workerReceivePromise])

    // Verify internal counts
    expect(mainChannel.getSentMessagesCount).toBe(1)
    expect(mainChannel.getReceivedAcksCount).toBe(1)
    expect(mainChannel.getErrorCount).toBe(0)
  })

  it('should handle acknowledgment errors correctly', async () => {
    const dataBuffer = new ArrayBuffer(8)
    const dataMessage: DataMessage<ArrayBuffer> = {
      id: generateUniqueId(),
      type: 'data',
      data: dataBuffer
    }

    // Spy on console.error to verify error logging
    // const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

    // Listen for data on the worker channel and send error acknowledgment
    const workerReceivePromise = (async () => {
      // eslint-disable-next-line no-unreachable-loop
      for await (const msg of workerChannel.receive) {
        expect(msg.id).toBe(dataMessage.id)
        expect(msg.type).toBe('data')
        // expect(msg.data).toBe(dataBuffer)

        // Send error acknowledgment
        const errorAck: AckMessage = {
          id: msg.id,
          type: 'ack',
          status: 'error',
          data: 'Processing failed'
        }
        await workerChannel.sendAck(errorAck)

        break
      }
    })()

    // Send data from main channel
    const sendPromise = mainChannel.sendData(dataMessage, [dataBuffer], 1000)

    // Await the worker to send the ack first
    await workerReceivePromise

    // Now, expect sendPromise to reject
    await expect(sendPromise).rejects.toThrow('Processing failed')

    // Verify internal counts
    expect(mainChannel.getSentMessagesCount).toBe(1)
    expect(mainChannel.getReceivedAcksCount).toBe(0)
    expect(mainChannel.getErrorCount).toBe(1)
  })

  it('should handle sendData timeouts correctly', async () => {
    const dataBuffer = new ArrayBuffer(8)
    const dataMessage: DataMessage<ArrayBuffer> = {
      id: generateUniqueId(),
      type: 'data',
      data: dataBuffer
    }

    // Spy on console.error to verify timeout logging
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

    // Send data from main channel with a short timeout - with no ack received
    const sendPromise = mainChannel.sendData(dataMessage, [dataBuffer], 1) // 1ms timeout

    // Await the sendPromise to reject due to timeout
    await expect(sendPromise).rejects.toThrow(`Send operation timed out for message ID ${dataMessage.id}`)

    // Verify internal counts
    expect(mainChannel.getSentMessagesCount).toBe(1)
    expect(mainChannel.getReceivedAcksCount).toBe(0)
    expect(mainChannel.getErrorCount).toBe(1)

    // Verify that an error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(`BufferedChannel (main): Send operation timed out for message ID ${dataMessage.id}:`),
      expect.anything()
    )

    // Restore the console spy
    consoleErrorSpy.mockRestore()
  })

  it('should queue sendData requests when buffer is full', async () => {
    const dataBuffer1 = new ArrayBuffer(8)
    const dataMessage1: DataMessage<ArrayBuffer> = {
      id: generateUniqueId(),
      type: 'data',
      data: dataBuffer1
    }

    const dataBuffer2 = new ArrayBuffer(8)
    const dataMessage2: DataMessage<ArrayBuffer> = {
      id: generateUniqueId(),
      type: 'data',
      data: dataBuffer2
    }

    const dataBuffer3 = new ArrayBuffer(8)
    const dataMessage3: DataMessage<ArrayBuffer> = {
      id: generateUniqueId(),
      type: 'data',
      data: dataBuffer3
    }

    const results: number[] = []

    // Listen for data on the worker channel
    const workerReceivePromise = (async () => {
      let count = 0

      for await (const msg of workerChannel.receive) {
        // Simulate processing delay for first two messages
        if (msg.id === dataMessage1.id || msg.id === dataMessage2.id) {
          // Send acknowledgment after a delay
          // eslint-disable-next-line no-loop-func
          setTimeout(() => {
            const ack: AckMessage = {
              id: msg.id,
              type: 'ack',
              status: 'ack',
              data: null
            }
            workerChannel.sendAck(ack)
              .then(() => {
                count++
              })
              .catch(error => {
                // Handle error if necessary
                // eslint-disable-next-line no-console
                console.error('Error sending acknowledgment:', error)
              })
          }, 100) // 100ms delay
        } else if (msg.id === dataMessage3.id) {
          // Immediate acknowledgment for third message
          const ack: AckMessage = {
            id: msg.id,
            type: 'ack',
            status: 'ack',
            data: null
          }
          await workerChannel.sendAck(ack)
          count++
        }

        if (count === 3) {
          break
        }
      }
    })()

    // Send three data messages; bufferSize = 2
    const sendPromise1 = mainChannel.sendData(dataMessage1, [dataBuffer1], 1000).then(() => results.push(1))
    const sendPromise2 = mainChannel.sendData(dataMessage2, [dataBuffer2], 1000).then(() => results.push(2))
    const sendPromise3 = mainChannel.sendData(dataMessage3, [dataBuffer3], 1000).then(() => results.push(3))

    // Initially, two messages are being processed, third is queued

    // Wait for all send operations to complete
    await Promise.all([sendPromise1, sendPromise2, sendPromise3, workerReceivePromise])

    // Verify that all messages were sent and acknowledged
    expect(results).toEqual([1, 2, 3])

    // Verify internal counts
    expect(mainChannel.getSentMessagesCount).toBe(3)
    expect(mainChannel.getReceivedAcksCount).toBe(3)
    expect(mainChannel.getErrorCount).toBe(0)
  })

  it('should handle multiple acknowledgments correctly', async () => {
    const messages = [
      { id: generateUniqueId(), type: 'data', data: new ArrayBuffer(8) },
      { id: generateUniqueId(), type: 'data', data: new ArrayBuffer(8) },
      { id: generateUniqueId(), type: 'data', data: new ArrayBuffer(8) }
    ] as Array<DataMessage<ArrayBuffer>>

    const results: number[] = []

    // Listen for data on the worker channel and send acknowledgments
    const workerReceivePromise = (async () => {
      let count = 0
      for await (const msg of workerChannel.receive) {
        // Immediate acknowledgment
        const ack: AckMessage = {
          id: msg.id,
          type: 'ack',
          status: 'ack',
          data: null
        }
        await workerChannel.sendAck(ack)
        count++

        if (count === 3) {
          break
        }
      }
    })()

    // Send all data messages
    const sendPromises = messages.map(async (msg, index) =>
      mainChannel.sendData(msg, [msg.data], 1000).then(() => results.push(index + 1))
    )

    // Await all send operations
    await Promise.all([...sendPromises, workerReceivePromise])

    // Verify that all messages were sent and acknowledged
    expect(results).toEqual([1, 2, 3])

    // Verify internal counts
    expect(mainChannel.getSentMessagesCount).toBe(3)
    expect(mainChannel.getReceivedAcksCount).toBe(3)
    expect(mainChannel.getErrorCount).toBe(0)
  })

  it('should gracefully handle worker termination', async () => {
    // Terminate the worker channel
    workerChannel.close()
  })
})
