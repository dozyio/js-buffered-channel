// test/unit/semaphore.spec.ts

import { describe, it, expect, beforeEach } from 'vitest'
import Semaphore from '../../src/semaphore'

describe('Semaphore', () => {
  let semaphore: Semaphore

  beforeEach(() => {
    // Initialize semaphore with 2 permits before each test
    semaphore = new Semaphore(2, { debug: false, name: 'test-semaphore' })
  })

  it('should initialize with correct number of permits', () => {
    // @ts-ignore: accessing private properties for testing purposes
    expect(semaphore.permits).toBe(2)
    // @ts-ignore
    expect(semaphore.maxPermits).toBe(2)
  })

  it('should acquire permits when available', async () => {
    await semaphore.acquire()
    // @ts-ignore
    expect(semaphore.permits).toBe(1)

    await semaphore.acquire()
    // @ts-ignore
    expect(semaphore.permits).toBe(0)
  })

  it('should queue acquire requests when no permits are available', async () => {
    const acquire1 = semaphore.acquire() // Resolves immediately
    const acquire2 = semaphore.acquire() // Resolves immediately
    const acquire3 = semaphore.acquire() // Queued

    // After two acquires, permits should be 0
    // @ts-ignore
    expect(semaphore.permits).toBe(0)

    // Resolve the queued acquire (acquire3) by releasing one permit
    semaphore.release()
    await acquire3
    // @ts-ignore
    expect(semaphore.permits).toBe(0) // Permits remain 0 as acquire3 has taken the released permit

    // Release another permit; no acquires are queued, so permits should increment to 1
    semaphore.release()
    // @ts-ignore
    expect(semaphore.permits).toBe(1)

    // Release one more permit; permits should now be 2 (maxPermits)
    semaphore.release()
    // @ts-ignore
    expect(semaphore.permits).toBe(2)
  })

  it('should not exceed maximum permits when releasing', () => {
    // Initially, permits are 2
    semaphore.release()
    // @ts-ignore
    expect(semaphore.permits).toBe(2) // Should not exceed maxPermits

    // Acquire all permits
    semaphore.acquire()
    semaphore.acquire()

    // Now, permits are 0
    // @ts-ignore
    expect(semaphore.permits).toBe(0)

    // Release all permits
    semaphore.release()
    semaphore.release()
    // @ts-ignore
    expect(semaphore.permits).toBe(2)
  })

  it('should handle multiple acquire and release operations correctly', async () => {
    const results: number[] = []

    // Acquire two permits
    await semaphore.acquire()
    await semaphore.acquire()

    // Now, permits are 0

    // Start three acquire operations
    const p1 = semaphore.acquire().then(() => results.push(1))
    const p2 = semaphore.acquire().then(() => results.push(2))
    const p3 = semaphore.acquire().then(() => results.push(3))

    // Release two permits
    semaphore.release()
    semaphore.release()
    semaphore.release()

    // Wait for p1 and p2 to resolve
    await Promise.all([p1, p2, p3])

    expect(results).toEqual([1, 2, 3])

    // @ts-ignore
    expect(semaphore.permits).toBe(0)
  })

  it('should handle releasing when there are no waiting acquires', () => {
    // Initially, permits are 2
    semaphore.release()
    // @ts-ignore
    expect(semaphore.permits).toBe(2) // Should not exceed maxPermits

    semaphore.release()
    // @ts-ignore
    expect(semaphore.permits).toBe(2) // Still should not exceed maxPermits

    // Acquire one permit
    semaphore.acquire()
    // @ts-ignore
    expect(semaphore.permits).toBe(1)

    // Release one permit
    semaphore.release()
    // @ts-ignore
    expect(semaphore.permits).toBe(2)
  })
})
