# BufferedChannel

BufferedChannel is a robust TypeScript library designed to facilitate reliable and efficient message passing between the main thread and worker threads in both **Node.js** and **browser** environments. Leveraging **semaphores** for concurrency control, BufferedChannel ensures backpressure management, acknowledgment handling, and error management, making it ideal for high-throughput applications.

## Architecture

BufferedChannel operates by establishing a communication channel between the main thread and worker threads using `MessagePort`. It leverages semaphores to manage the number of concurrent messages being sent, ensuring that the system can handle backpressure gracefully.

## Installation

Install BufferedChannel via npm:

```bash
npm install buffered-channel
```

Or using Yarn:

```bash
yarn add buffered-channel
```

## Usage

BufferedChannel can be used in both **Node.js** and **browser** environments. See the [example](example) folder for a browser example.

## API Reference

### BufferedChannel

A class that manages the sending and receiving of messages between the main thread and worker threads with concurrency control and acknowledgment handling.

#### Constructor

```typescript
constructor(
  port: MessagePortLike,
  bufferSize: number = 1,
  opts: BufferedChannelOpts = {}
)
```

- **port**: The `MessagePort` to use for communication.
- **bufferSize**: The maximum number of concurrent send operations.
- **opts**: Optional configuration options.
  - **debug**: Enable debug logging.
  - **name**: Name of the channel for logging purposes.
  - **throwOnError**: Whether to throw errors or log them.

#### Methods

- **sendData**

  Sends a data message through the channel with backpressure control.

  ```typescript
  async sendData(
    message: DataMessage<T>,
    transfer: Transferable[] = [],
    timeout?: number | null
  ): Promise<void>
  ```

  - **message**: The data message to send.
  - **transfer**: Transferable objects (e.g., `ArrayBuffer`) to transfer ownership.
  - **timeout**: Optional timeout in milliseconds for the send operation.

- **sendAck**

  Sends an acknowledgment message through the channel.

  ```typescript
  async sendAck(
    ack: AckMessage,
    transfer: Transferable[] = []
  ): Promise<void>
  ```

  - **ack**: The acknowledgment message to send.
  - **transfer**: Transferable objects to transfer ownership.

- **receive**

  An asynchronous generator that yields incoming data messages.

  ```typescript
  get receive(): AsyncIterableIterator<DataMessage<T>>
  ```

- **logPerformanceMetrics**

  Logs performance metrics related to message sending and acknowledgment handling.

  ```typescript
  logPerformanceMetrics(): void
  ```

#### Properties (Public Getters)

- **sentMessagesCountPublic**: `number`  
  Number of messages sent.

- **receivedAcksCountPublic**: `number`  
  Number of acknowledgments received.

- **totalLatencyPublic**: `number`  
  Total latency accumulated from message sending to acknowledgment receipt.

- **errorCountPublic**: `number`  
  Number of errors encountered during message processing.

## License

This project is licensed under the [MIT License](LICENSE).
