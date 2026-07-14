/**
 * Pins locais (`localStorage` key: `pr-network-pins` — array de keys).
 */

import type { PinSet } from '../domain/filters'

const PINS_KEY = 'pr-network-pins'

export type { PinSet }

export function loadPins(): PinSet {
  try {
    const raw = localStorage.getItem(PINS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((k): k is string => typeof k === 'string' && k.length > 0))
  } catch {
    return new Set()
  }
}

export function savePins(pins: PinSet): void {
  localStorage.setItem(PINS_KEY, JSON.stringify([...pins]))
}

export function isPinned(pins: PinSet, key: string): boolean {
  return pins.has(key)
}

export function togglePin(pins: PinSet, key: string): PinSet {
  const next = new Set(pins)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}
