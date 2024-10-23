// src/types.ts

export interface MessagePortLike {
  postMessage(message: any, transferList?: Transferable[]): void
  start(): void
  close(): void

  // Event handling methods
  on(event: 'message', listener: (data: any) => void): this
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void
}
