#Requires AutoHotkey v2.0
#SingleInstance Force
Persistent
CoordMode "ToolTip", "Screen"

; =====================================================================
;  Allflame Voyage - chart clipboard collector  (AutoHotkey v2)
;
;  This tool sends ZERO inputs to the game. Ever. No keystrokes, no
;  clicks, no mouse movement, no window switching. You press every
;  Ctrl+C yourself; the collector only watches the clipboard you just
;  copied to - the same thing trade-overlay tools have done for years -
;  counts the charts, and hands the solver ONE combined paste at the
;  end so you don't alt-tab per chart.
;
;  USE
;   1. Run this script (it lives in the tray).
;   2. Press F7 - copy mode ON. A counter appears on screen.
;   3. In PoE, hover each chart and press Ctrl+C yourself. The counter
;      ticks up for every chart it sees (non-chart items are ignored,
;      copying the same chart twice in a row is ignored).
;   4. Press F7 again - copy mode OFF. Everything you collected is now
;      on the clipboard as one batch.
;   5. Ctrl+V on the solver page. Done. (Re-pastes of charts already in
;      your library are skipped by the site automatically.)
;
;  F7 is the only hotkey, and it only talks to this script - the game
;  never receives anything from this program.
; =====================================================================

CollectorVersion := "2026-08-18"

Collecting := false
Collected := []
LastCaptured := ""

; a chart's item text starts with its class header (English or Korean)
IsChartText(text) {
    return RegExMatch(text, "im)^\s*(Item Class\s*[:：]\s*Charts?|아이템 종류\s*[:：]\s*해도)")
}

ShowCounter() {
    global Collecting, Collected
    if Collecting
        ToolTip "📋 Copy mode: " Collected.Length " chart" (Collected.Length = 1 ? "" : "s")
            . " collected`nCtrl+C your charts in game - F7 to finish",
            A_ScreenWidth // 2 - 140, 40
}

OnClipChanged(dataType) {
    global Collecting, Collected, LastCaptured
    if (!Collecting || dataType != 1)
        return
    text := ""
    try text := A_Clipboard
    if (text = "")
        return
    if !IsChartText(text)
        return
    ; double-tap protection: the SAME chart copied twice in a row is one
    ; chart (two different-but-identical charts still count when they are
    ; copied non-consecutively)
    if (text == LastCaptured)
        return
    LastCaptured := text
    Collected.Push(text)
    SoundBeep 880, 60
    ShowCounter()
}
OnClipboardChange OnClipChanged

ToggleCollect(*) {
    global Collecting, Collected, LastCaptured
    if !Collecting {
        Collecting := true
        Collected := []
        LastCaptured := ""
        ShowCounter()
        return
    }
    Collecting := false
    if (Collected.Length = 0) {
        ToolTip "Copy mode off - nothing collected."
        SetTimer () => ToolTip(), -2500
        return
    }
    combined := ""
    for , chart in Collected
        combined .= (combined = "" ? "" : "`n`n") chart
    A_Clipboard := combined
    ToolTip "✅ " Collected.Length " chart" (Collected.Length = 1 ? "" : "s")
        . " on the clipboard - Ctrl+V on the solver page to import them all.",
        A_ScreenWidth // 2 - 160, 40
    SetTimer () => ToolTip(), -6000
    SoundBeep 1200, 90
}

F7:: ToggleCollect()

A_TrayMenu.Insert("1&", "Toggle copy mode (F7)", ToggleCollect)
A_TrayMenu.Default := "Toggle copy mode (F7)"
A_IconTip := "Voyage chart collector - F7 toggles copy mode"
TrayTip "Voyage chart collector ready", "F7 starts copy mode. This tool never sends any input to the game.", 1

