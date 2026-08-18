import type { ChartData } from '../types'

export interface DedupeResult {
  /** charts that are genuinely new to the library */
  fresh: ChartData[]
  /** how many incoming charts were re-scans of charts already held */
  skipped: number
}

/**
 * An incoming chart whose verbatim text matches one already in the library is
 * a RE-PASTE of the same physical item, not a second copy - importing it
 * again put phantom duplicates in the pool and the solver then "used the same
 * chart twice" (issue #46). Matching is count-aware per verbatim rawText:
 * copies beyond what the library already holds still import, so owning two
 * genuinely identical physical charts keeps working.
 */
export function dedupeNewCharts(pool: ChartData[], incoming: ChartData[]): DedupeResult {
  const held = new Map<string, number>()
  for (const chart of pool) {
    if (!chart.rawText) continue
    held.set(chart.rawText, (held.get(chart.rawText) ?? 0) + 1)
  }
  const fresh: ChartData[] = []
  let skipped = 0
  for (const chart of incoming) {
    const key = chart.rawText
    if (!key) {
      // no verbatim text to compare - never guess, always keep
      fresh.push(chart)
      continue
    }
    const remaining = held.get(key) ?? 0
    if (remaining > 0) {
      held.set(key, remaining - 1)
      skipped++
    } else {
      fresh.push(chart)
    }
  }
  return { fresh, skipped }
}
