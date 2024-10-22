/* eslint-disable no-console */
// src/semaphore.ts

export default class Semaphore {
  private permits: number
  private readonly waiting: Array<() => void> = []
  private readonly maxPermits: number
  public readonly what: string

  constructor (permits: number, what: string) {
    this.permits = permits
    this.maxPermits = permits
    this.what = what
    console.log(`Semaphore initialized with maxPermits: ${this.maxPermits} for ${this.what}`)
  }

  /**
   * Acquires a permit from the semaphore.
   * If a permit is available, it is granted immediately.
   * Otherwise, the request waits until a permit is released.
   */
  async acquire (): Promise<void> {
    console.log(`${this.what} Semaphore: Attempting to acquire a permit. Current permits: ${this.permits}`)
    if (this.permits > 0) {
      this.permits--
      console.log(`${this.what} Semaphore: Permit acquired. Remaining permits: ${this.permits}`)
      return
    }

    console.log(`${this.what} Semaphore: No permits available. Queuing the request.`)
    return new Promise<void>((resolve) => {
      this.waiting.push(resolve)
    })
  }

  /**
   * Releases a permit back to the semaphore.
   * If there are pending acquire requests, the next one is granted a permit.
   */
  release (): void {
    console.log(`${this.what} Semaphore: Releasing a permit.`)
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()
      if (resolve !== undefined) {
        console.log(`${this.what} Semaphore: Resolving a queued acquire request.`)
        resolve()
        // No change to permits since a permit is immediately granted to the next requester
        return
      }
    }

    if (this.permits < this.maxPermits) {
      this.permits++
      console.log(`${this.what} Semaphore: Permit released. Available permits: ${this.permits}`)
    } else {
      console.warn(`${this.what} Semaphore: Attempted to release more permits than the maximum.`)
    }
  }
}
