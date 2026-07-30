import { useEffect, useState } from 'react'
import { ALL_GOOD_MODS_REGEX } from '../data/strategies'
import { generateDemoCharts } from '../logic/demo'
import { isChartClipboardText, parseChartText } from '../logic/parser'
import type { AppState } from '../logic/storage'
import { defaultState } from '../logic/storage'
import type { ChartData } from '../types'

interface Props {
  onImport: (charts: ChartData[]) => void
  state: AppState
  onLoadState: (s: AppState) => void
}

export function ImportPanel({ onImport, state, onLoadState }: Props) {
  const [text, setText] = useState('')
  const [msg, setMsg] = useState('')

  const doParse = (raw?: string) => {
    const source = raw ?? text
    const { charts, rejected } = parseChartText(source)
    const notCharted = rejected.filter((r) => r.reason.startsWith('not charted'))
    if (charts.length === 0 && rejected.length === 0) {
      setMsg('No items recognised. Is this Ctrl+C item text?')
      return
    }
    if (charts.length > 0) {
      onImport(charts)
      setText('')
    }
    const parts: string[] = []
    if (charts.length) parts.push(`Imported ${charts.length} chart${charts.length === 1 ? '' : 's'}`)
    if (notCharted.length)
      parts.push(
        `skipped ${notCharted.length} uncharted (run them first to reveal their modifier)`,
      )
    const otherRejects = rejected.length - notCharted.length
    if (otherRejects > 0) parts.push(`skipped ${otherRejects} unrecognised`)
    setMsg(parts.join('; ') || 'Nothing imported')
  }

  // Ctrl+V anywhere on the page: if the clipboard holds chart item text, import
  // it straight away (no need to focus the box). Normal pastes into fields are
  // untouched because only chart-shaped text is intercepted.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const clip = e.clipboardData?.getData('text') ?? ''
      if (!isChartClipboardText(clip)) return
      e.preventDefault()
      doParse(clip)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

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
          'Copy a chart in game (Ctrl+C), then press Ctrl+V anywhere on this page to import it. Or paste here and hit Parse & Add.'
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
        <summary>🖱️ Bulk-import every chart from PoE (Windows)</summary>
        <p className="muted">
          A tiny AutoHotkey script hovers each chart in your Voyage panel, copies it, and pastes
          the whole lot in here in one go - so you don't Ctrl+C / Ctrl+V them one by one.
        </p>
        <a className="ahk-dl" href={`${import.meta.env.BASE_URL}voyage-import.ahk`} download>
          ⬇ Download voyage-import.ahk
        </a>
        <ol className="ahk-steps">
          <li>
            Install{' '}
            <a href="https://www.autohotkey.com/" target="_blank" rel="noopener noreferrer">
              AutoHotkey v2
            </a>{' '}
            (Windows only).
          </li>
          <li>
            In PoE (Windowed or Windowed Fullscreen), open the Voyage board so your chart panel is
            fully visible and not scrolled.
          </li>
          <li>
            Keep this tab open - the script finds it by its title, <em>Allflame Voyage Solver</em>.
            Click once on this page first so it has focus.
          </li>
          <li>
            Double-click the script, then calibrate once: hover the <strong>top-left</strong> chart
            and press <kbd>F7</kbd>, hover the <strong>bottom-right</strong> cell of the grid and
            press <kbd>F8</kbd>. (Edit GridCols/GridRows in the file if your panel isn't 6×10.)
          </li>
          <li>
            <kbd>F9</kbd> runs the import · <kbd>F10</kbd> aborts.
          </li>
        </ol>
        <p className="muted small">
          If PoE runs as administrator, run the script as administrator too, or its keypresses
          won't reach the game. Don't touch the mouse or keyboard while it's running.
        </p>
      </details>
    </div>
  )
}
