import { useCallback, useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { ALL_GOOD_MODS_REGEX, RARE_IMPLICITS } from '../data/strategies'
import { generateDemoCharts } from '../logic/demo'
import { parseBorderOcrPayload } from '../logic/borderOcr'
import { isChartClipboardText, parseChartText } from '../logic/parser'
import { dedupeNewCharts } from '../logic/importDedupe'
import type { AppState } from '../logic/storage'
import { defaultState } from '../logic/storage'
import type { ChartData } from '../types'

interface Props {
  onImport: (charts: ChartData[]) => void
  state: AppState
  onLoadState: Dispatch<SetStateAction<AppState>>
}

export function ImportPanel({ onImport, state, onLoadState }: Props) {
  const [text, setText] = useState('')
  const [msg, setMsg] = useState('')
  // celebratory alert when an import brings in rare-implicit (Divine fuel) charts
  const [rareAlert, setRareAlert] = useState('')

  const doParse = useCallback((raw?: string) => {
    const source = raw ?? text
    const borderOcr = parseBorderOcrPayload(source)
    const { charts, rejected } = parseChartText(borderOcr.chartText)
    const notCharted = rejected.filter((r) => r.reason.startsWith('not charted'))
    if (charts.length === 0 && rejected.length === 0 && borderOcr.blockCount === 0) {
      setMsg('No items recognised. Is this Ctrl+C item text?')
      return
    }

    // Re-pasting charts that are already in the library created phantom
    // duplicates the solver then placed as "the same chart twice" (issue #46)
    const { fresh, skipped } = dedupeNewCharts(state.pool, charts)

    if (borderOcr.blockCount > 0) {
      // A complete importer sweep is a snapshot of all 12 current rolls.
      // Start clean so an OCR miss cannot leave a stale modifier from an
      // earlier run and masquerade as a wrongly recognized border - but an
      // ALL-miss sweep (bad aim, tooltips not visible) must never wipe
      // borders the user already entered.
      onLoadState((current) => {
        const fullSweep = borderOcr.blockCount >= 12 && borderOcr.matches.length > 0
        const borders = fullSweep ? [...borderOcr.borders] : [...current.borders]
        for (const match of borderOcr.matches) borders[match.index] = match.id
        return {
          ...current,
          pool: fresh.length > 0 ? [...current.pool, ...fresh] : current.pool,
          borders,
        }
      })
    } else if (fresh.length > 0) {
      onImport(fresh)
    }
    if (charts.length > 0 || borderOcr.blockCount > 0) {
      setText('')
    }

    const parts: string[] = []
    if (fresh.length) parts.push(`Imported ${fresh.length} chart${fresh.length === 1 ? '' : 's'}`)
    if (skipped)
      parts.push(
        `skipped ${skipped} re-scanned chart${skipped === 1 ? '' : 's'} already in your library`
          + ' (use "Clear all charts" first for a fresh import)',
      )
    // distinct physical charts always differ in their rolled values, so a big
    // batch of byte-identical imports means the same item text was repeated
    // (issue #20)
    if (charts.length >= 5) {
      const key = (c: ChartData) =>
        JSON.stringify([c.name, c.level, c.modIds, c.implicitText, c.rewards, c.shape, c.rawText])
      const first = key(charts[0])
      if (charts.every((c) => key(c) === first))
        parts.push(
          `⚠ all ${charts.length} are IDENTICAL - the same chart text seems to have been pasted repeatedly`,
        )
    }
    if (borderOcr.blockCount > 0) {
      parts.push(
        `matched ${borderOcr.matches.length}/${borderOcr.blockCount} border modifier${
          borderOcr.blockCount === 1 ? '' : 's'
        }`,
      )
    }
    if (notCharted.length)
      parts.push(
        `skipped ${notCharted.length} uncharted (run them first to reveal their modifier)`,
      )
    const otherRejects = rejected.length - notCharted.length
    if (otherRejects > 0) parts.push(`skipped ${otherRejects} unrecognised`)
    if (borderOcr.blockCount > 0 && borderOcr.matches.length === 0) {
      parts.push(
        'no border tooltips recognised - kept your existing borders (recheck the border calibration in the script wizard)',
      )
    } else if (borderOcr.misses.length > 0) {
      parts.push(`OCR unmatched at border${borderOcr.misses.length === 1 ? '' : 's'} ${borderOcr.misses
        .map((miss) => miss.index + 1)
        .join(', ')}`)
    }
    setMsg(parts.join('; ') || 'Nothing imported')

    // rare-implicit charts are the Divine strategies' fuel - flag them loudly
    // so a jackpot piece never slips into the library unnoticed (only newly
    // imported ones celebrate - re-scans are old news)
    const rares = fresh.filter((c) =>
      c.modIds.some((id) => (RARE_IMPLICITS as readonly string[]).includes(id)),
    ).length
    setRareAlert(
      rares > 0
        ? `${rares} Rare Monsters chart${rares === 1 ? '' : 's'} imported - Divine-strategy fuel! Locked 🔒 in the library until you run a Divine border board.`
        : '',
    )
  }, [onImport, onLoadState, state.pool, text])

  // Ctrl+V anywhere on the page: if the clipboard holds chart item text, import
  // it straight away (no need to focus the box). Normal pastes into fields are
  // untouched because only chart-shaped text is intercepted.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const clip = e.clipboardData?.getData('text') ?? ''
      if (!isChartClipboardText(clip) && !/===\s*VOYAGE BORDER/i.test(clip)) return
      e.preventDefault()
      doParse(clip)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [doParse])

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'voyage-solver-state.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importJson = (file: File) => {
    file.text().then((t) => {
      try {
        onLoadState({ ...defaultState(), ...JSON.parse(t) })
        setMsg('State loaded from JSON')
      } catch {
        setMsg('Invalid JSON file')
      }
    })
  }

  const clearAll = () => {
    if (window.confirm('Clear all charts, board and borders?')) onLoadState(defaultState())
  }

  return (
    <div className="import-panel">
      <div className="panel-title">Import</div>
      <textarea
        rows={5}
        placeholder={
          'Copy a chart in game (Ctrl+C), then press Ctrl+V anywhere on this page to import it - name, level, modifiers and shape all come along.'
        }
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="import-actions">
        <button onClick={() => doParse()} disabled={!text.trim()}>
          Parse & Add
        </button>
        <button
          title="Generate random charts to try out the tool"
          onClick={() => {
            onImport(generateDemoCharts(25))
            setMsg('Added 25 random demo charts')
          }}
        >
          🎲 Demo ×25
        </button>
        <button onClick={exportJson} title="Save your charts to a JSON file">
          Export
        </button>
        <label className="file-btn" title="Load charts from a JSON file">
          Load
          <input
            type="file"
            accept=".json"
            onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])}
          />
        </label>
        <button onClick={clearAll} title="Clear all charts, board and borders">
          Reset
        </button>
      </div>
      {msg && <div className="muted pad">{msg}</div>}
      {rareAlert && (
        <div className="import-rare-alert">
          <span>🎰 {rareAlert}</span>
          <button className="announce-close" title="Dismiss" onClick={() => setRareAlert('')}>
            ✕
          </button>
        </div>
      )}

      <details className="ahk-help">
        <summary>🎲 Rolling & keeping charts (Milky's regexes)</summary>
        <p className="muted">
          Charts can't be rolled after running, so roll first (quantity scales strongboxes). Paste
          these into the in-game chart search - from Milky's sheet.
        </p>
        <div className="roll-regex-row">
          <span className="roll-regex-label">All good mods (keepers)</span>
          <input readOnly value={ALL_GOOD_MODS_REGEX} onFocus={(e) => e.target.select()} />
        </div>
        <div className="roll-regex-row">
          <span className="roll-regex-label">120%+ quantity roll</span>
          <input readOnly value={'"m q.*(1[2-9].|[2-9]..)%"'} onFocus={(e) => e.target.select()} />
        </div>
        <div className="roll-regex-row">
          <span className="roll-regex-label">75%+ sulphur (save for Filthscrabble)</span>
          <input readOnly value={'"sul.*(7[5-9]|[89].|\\d..)%"'} onFocus={(e) => e.target.select()} />
        </div>
      </details>

      <details className="ahk-help">
        <summary>📋 Chart collector - one paste for your whole library (Windows)</summary>
        <p className="muted">
          A tiny optional helper that <strong>never sends a single input to the game</strong> -
          no keystrokes, no clicks, nothing. You press every Ctrl+C yourself; it only watches
          the clipboard you copied to (like the trade overlays do), counts the charts, and
          hands this page one combined paste at the end.
        </p>
        <a
          className="ahk-dl"
          href={`${import.meta.env.BASE_URL}voyage-clip-collector.ahk`}
          download
        >
          ⬇ Download voyage-clip-collector.ahk
        </a>
        <ol className="ahk-steps">
          <li>
            Install{' '}
            <a href="https://www.autohotkey.com/" target="_blank" rel="noopener noreferrer">
              AutoHotkey v2
            </a>{' '}
            and run the script (it lives in the tray).
          </li>
          <li>
            Press <kbd>F7</kbd> - copy mode on, a counter appears on screen.
          </li>
          <li>
            In PoE, hover each chart and press <kbd>Ctrl+C</kbd> yourself - the counter ticks
            up. Non-chart items and accidental double-copies are ignored.
          </li>
          <li>
            Press <kbd>F7</kbd> again, switch here once, <kbd>Ctrl+V</kbd> - the whole batch
            imports in one paste (charts already in your library are skipped).
          </li>
        </ol>
      </details>
      <p className="muted small">
        The old bulk importer stays retired: GGG's macro rules ask for one action per keypress
        and there's no clear ruling for tools like it - a grey area isn't worth anyone's
        account. The collector above is different: every keypress is your own, and it sends
        nothing to the game.
      </p>
      <p className="muted small">
        Problems or ideas?{' '}
        <a
          href="https://github.com/one-more-map/one-more-map.github.io/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open a GitHub issue
        </a>{' '}
        - actively monitored, and pull requests are welcome.
      </p>
    </div>
  )
}
