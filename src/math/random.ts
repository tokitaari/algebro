/** Source of uniformly distributed numbers in [0, 1), like Math.random. */
export type Rng = () => number

/** Small seeded PRNG (mulberry32); deterministic for tests and reproducible series. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Integer in [min, max], both inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

/** Non-zero integer with absolute value in [1, maxAbs]. */
export function randNonZero(rng: Rng, maxAbs: number): number {
  const n = randInt(rng, 1, maxAbs)
  return rng() < 0.5 ? -n : n
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new RangeError('Cannot pick from an empty list')
  return items[Math.floor(rng() * items.length)] as T
}

/** Picks an entry according to its relative weight. */
export function pickWeighted<T>(rng: Rng, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((sum, [, w]) => sum + w, 0)
  let r = rng() * total
  for (const [item, w] of items) {
    r -= w
    if (r < 0) return item
  }
  const last = items[items.length - 1]
  if (!last) throw new RangeError('Cannot pick from an empty list')
  return last[0]
}

export function intGcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) [x, y] = [y, x % y]
  return x
}
