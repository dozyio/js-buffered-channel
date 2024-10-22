/* eslint-disable no-console */
// src/semaphore.ts

export interface SemaphoreOpts {
  debug?: boolean
  name?: string
}

export default class Semaphore {
  private permits: number
  private readonly waiting: Array<() => void> = []
  private readonly maxPermits: number
  private readonly debug: boolean
  private readonly name: string

  constructor (permits: number, opts: SemaphoreOpts = {}) {
    this.permits = permits
    this.maxPermits = permits
    this.debug = opts.debug ?? false
    this.name = opts.name ?? ''

    console.log(`Semaphore initialized with maxPermits: ${this.maxPermits} for ${this.name}`)
  }

  /**
   * Acquires a permit from the semaphore.
   * If a permit is available, it is granted immediately.
   * Otherwise, the request waits until a permit is released.
   */
  async acquire (): Promise<void> {
    if (this.debug) {
      console.log(`${this.name} Semaphore: Attempting to acquire a permit. Current permits: ${this.permits}`)
    }
    if (this.permits > 0) {
      this.permits--
      if (this.debug) {
        console.log(`${this.name} Semaphore: Permit acquired. Remaining permits: ${this.permits}`)
      }
      return
    }

    if (this.debug) {
      console.log(`${this.name} Semaphore: No permits available. Queuing the request.`)
    }
    return new Promise<void>((resolve) => {
      this.waiting.push(resolve)
    })
  }

  /**
   * Releases a permit back to the semaphore.
   * If there are pending acquire requests, the next one is granted a permit.
   */
  release (): void {
    if (this.debug) {
      console.log(`${this.name} Semaphore: Releasing a permit.`)
    }
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()
      if (resolve !== undefined) {
        if (this.debug) {
          console.log(`${this.name} Semaphore: Resolving a queued acquire request.`)
        }
        resolve()
        // No change to permits since a permit is immediately granted to the next requester
        return
      }
    }

    if (this.permits < this.maxPermits) {
      this.permits++
      if (this.debug) {
        console.log(`${this.name} Semaphore: Permit released. Available permits: ${this.permits}`)
      }
    } else {
      if (this.debug) {
        console.warn(`${this.name} Semaphore: Attempted to release more permits than the maximum.`)
      }
    }
  }
}
