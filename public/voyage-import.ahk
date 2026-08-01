#Requires AutoHotkey v2.0
#SingleInstance Force
SetWorkingDir A_ScriptDir
SetTitleMatchMode 2          ; match window titles by "contains"
CoordMode "Mouse", "Screen"  ; all coords are absolute screen pixels
CoordMode "ToolTip", "Screen"

; =====================================================================
;  Allflame Voyage - bulk chart + board-border importer  (AutoHotkey v2)
;
;  Three phases:
;    Phase 1 - stays in PoE, hovers every cell and Ctrl+C's it, appending
;              each chart's text into one buffer (no window switching).
;    Phase 2 - hovers the 12 board-border modifiers. A temporary PowerShell
;              helper captures the PoE window and reads each tooltip with the
;              Windows OCR engine. Screenshots never leave the PC.
;    Phase 3 - switches to the browser ONCE and pastes the whole buffer;
;              the solver parses and imports every chart from that one paste.
;    Empty cells copy nothing and are skipped.
;    English and Korean client Chart headers are both supported.
;
;  ---------------------------------------------------------------
;  ONE-TIME SETUP
;   1. Install AutoHotkey v2  (https://www.autohotkey.com/).
;   2. In PoE open the Voyage board so the Chart panel is fully
;      visible and NOT scrolled. Use Windowed or Windowed Fullscreen
;      (exclusive fullscreen can block the mouse/keys).
;   3. Open the solver in your browser; the tab title must contain
;      "Allflame Voyage Solver", and click once inside the page so
;      focus is on the page (not the address bar).
;   4. Double-click this file to run it (it lives in the tray).
;
;  CALIBRATION (the Setup wizard walks you through it)
;   The wizard opens on first run; later it lives in the tray menu
;   ("Setup wizard..."). One key does it all: hover whatever the wizard
;   asks for and press F7 - chart grid corners, then each of the 12
;   border points, then an optional aim preview.
;   - Set GridCols / GridRows below to match your panel.
;
;  RUN
;   F9  = do the real import sweep (charts + borders)
;   Shift+F9 = import the 12 borders only (no chart copying)
;   F10 = abort at any time
;   All keys are rebindable: right-click (or double-click) the tray icon
;   and choose "Keybinds...". Saved to voyage-import.ini.
;   The calibration key (F7) only works while the Setup wizard is open
;   (tray icon -> "Setup wizard...").
;
;  If PoE is running as administrator, run this script as admin too,
;  or its keypresses won't reach the game. Don't touch the mouse or
;  keyboard while it's sweeping.
; =====================================================================

; ---------------- CONFIG ----------------
PoeWinTitle     := "Path of Exile"           ; PoE window title
BrowserWinTitle := "Allflame Voyage Solver"  ; the solver's browser tab title

GridCols := 6    ; columns in the Chart panel
GridRows := 10   ; rows to sweep (overshooting is fine - empty cells skip)

ActivateDelay := 60    ; ms after focusing a window (paid only ~twice total now)
HoverDelay    := 28    ; ms for PoE to register the cursor before Ctrl+C
BorderHoverDelay := 250 ; ms for a border tooltip to appear before OCR capture
BorderOcrAttempts := 2  ; retry once when both filtered and unfiltered OCR are empty
BorderPreviewDelay := 900 ; ms per point during the Ctrl+F4 visual preview
PasteDelay    := 90    ; ms after the single big paste
ClipTimeout   := 0.2   ; seconds to wait for Ctrl+C (only empty cells wait the full time)
OcrTimeout    := 90    ; seconds before a stuck Windows OCR scan is stopped
; If it ever MISSES a chart, raise HoverDelay ~10ms at a time (the cursor
; isn't settling before Ctrl+C). If the final paste drops some, raise PasteDelay.
; ----------------------------------------

IniFile := A_ScriptDir "\voyage-import.ini"
TLx := IniRead(IniFile, "grid", "TLx", "0") + 0
TLy := IniRead(IniFile, "grid", "TLy", "0") + 0
BRx := IniRead(IniFile, "grid", "BRx", "0") + 0
BRy := IniRead(IniFile, "grid", "BRy", "0") + 0
BorderTLx := IniRead(IniFile, "board", "TopLeftX", "0") + 0
BorderTLy := IniRead(IniFile, "board", "TopY", "0") + 0
BorderBRx := IniRead(IniFile, "board", "BottomRightX", "0") + 0
BorderBRy := IniRead(IniFile, "board", "BottomY", "0") + 0
ExactBorderPoints := []
Loop 12 {
    exactX := IniRead(IniFile, "board-exact", "Point" A_Index "X", "0") + 0
    exactY := IniRead(IniFile, "board-exact", "Point" A_Index "Y", "0") + 0
    if (exactX = 0 && exactY = 0) {
        ExactBorderPoints := []
        break
    }
    ExactBorderPoints.Push([exactX, exactY])
}
ExactBorderNext := 0
ScriptPid := ProcessExist()
OcrHelper := A_Temp "\voyage-border-ocr-" ScriptPid ".ps1"
OcrOutput := A_Temp "\voyage-border-ocr-" ScriptPid ".txt"
OcrSession := A_Temp "\voyage-border-ocr-" ScriptPid
OcrPid := 0
Running := false

CleanupOcr(*) {
    global OcrHelper, OcrOutput, OcrPid, OcrSession
    if OcrPid && ProcessExist(OcrPid)
        try ProcessClose OcrPid
    try FileDelete OcrHelper
    try FileDelete OcrOutput
    try FileDelete OcrSession ".cmd"
    try FileDelete OcrSession ".cmd.tmp"
    try FileDelete OcrSession ".ready"
    Loop 12
        try FileDelete OcrSession "-res-" (A_Index - 1) ".txt"
}
OnExit CleanupOcr

; ---------------- KEYBINDS ----------------
; Every hotkey is rebindable: right-click the tray icon -> "Keybinds..."
; (or double-click it). Choices are saved to voyage-import.ini [keys] and
; applied immediately. Modifier syntax: ^ Ctrl, ! Alt, + Shift.
KeyDefs := [
    ["RunSweep",      "F9",  "Run import (charts + border OCR)"],
    ["BordersOnly",   "+F9", "Import borders only (OCR, no charts)"],
    ["Abort",         "F10", "Abort"],
    ["WizardSet",     "F7",  "Set the current wizard point (wizard only)"],
]
KeyActions := Map(
    "RunSweep", RunSweep,
    "BordersOnly", RunBordersOnly,
    "Abort", AbortAll,
    "WizardSet", WizardSetPressed,
)
Keys := Map()
for def in KeyDefs
    Keys[def[1]] := IniRead(IniFile, "keys", def[1], def[2])
RegisteredKeys := []

; the calibration key exists only while the Setup wizard is open - day to day
; the script holds just Run / Borders-only / Abort
WIZARD_ONLY := Map("WizardSet", 1)

WizardActive() {
    global WizardGui
    return IsSet(WizardGui) && IsObject(WizardGui) && WinExist("ahk_id " WizardGui.Hwnd)
}

/** human-readable form of an AHK hotkey string, e.g. "^F5" -> "Ctrl+F5" */
KeyLabel(hk) {
    label := ""
    i := 1
    while i <= StrLen(hk) {
        c := SubStr(hk, i, 1)
        if (c = "^")
            label .= "Ctrl+"
        else if (c = "!")
            label .= "Alt+"
        else if (c = "+")
            label .= "Shift+"
        else if (c = "#")
            label .= "Win+"
        else
            break
        i++
    }
    return label . SubStr(hk, i)
}

ApplyKeybinds() {
    global KeyDefs, KeyActions, Keys, RegisteredKeys, WIZARD_ONLY
    for hk in RegisteredKeys
        try Hotkey hk, "Off"
    RegisteredKeys := []
    for def in KeyDefs {
        action := def[1]
        if (WIZARD_ONLY.Has(action) && !WizardActive())
            continue
        try {
            Hotkey Keys[action], KeyActions[action], "On"
            RegisteredKeys.Push(Keys[action])
        } catch {
            ; invalid saved key: fall back to the default so nothing is lost
            Keys[action] := def[2]
            IniWrite def[2], IniFile, "keys", action
            Hotkey def[2], KeyActions[action], "On"
            RegisteredKeys.Push(def[2])
        }
    }
}

ShowKeybindGui(*) {
    global KeyDefs, Keys, IniFile
    static open := 0
    if IsObject(open) {
        open.Show()
        return
    }
    kb := Gui("+AlwaysOnTop", "Voyage Importer - Keybinds")
    kb.SetFont("s10")
    kb.Add("Text", "xm w360", "Click a box and press the new key or combo, then Save."
        . " Leave a box empty to keep its current key.")
    controls := Map()
    for def in KeyDefs {
        kb.Add("Text", "xm w230 h22 +0x200", def[3])
        ctl := kb.Add("Hotkey", "x+8 yp w120")
        ctl.Value := Keys[def[1]]
        controls[def[1]] := ctl
    }
    saveBtn := kb.Add("Button", "xm w120 Default", "Save")
    resetBtn := kb.Add("Button", "x+8 w120", "Reset defaults")

    DoSave(*) {
        pending := Map()
        for def in KeyDefs {
            v := controls[def[1]].Value
            pending[def[1]] := (v = "") ? Keys[def[1]] : v
        }
        ; refuse duplicate assignments - each action needs its own key
        seen := Map()
        for action, hk in pending {
            if seen.Has(hk) {
                MsgBox "Two actions share the key " KeyLabel(hk) ". Give each action its own key."
                return
            }
            seen[hk] := action
        }
        for action, hk in pending {
            Keys[action] := hk
            IniWrite hk, IniFile, "keys", action
        }
        ApplyKeybinds()
        kb.Hide()
        Flash "Keybinds saved and applied.", 2500
    }
    DoReset(*) {
        for def in KeyDefs
            controls[def[1]].Value := def[2]
    }
    saveBtn.OnEvent("Click", DoSave)
    resetBtn.OnEvent("Click", DoReset)
    kb.OnEvent("Close", (*) => (kb.Hide(), true)) ; hide, don't destroy - reopened from the tray
    open := kb
    kb.Show()
}

A_TrayMenu.Insert("1&", "Keybinds...", ShowKeybindGui)
A_TrayMenu.Default := "Keybinds..."
ApplyKeybinds()

; ---------------- FIRST-RUN SETUP WIZARD ----------------
; A small always-on-top overlay that walks new users through calibration.
; It auto-advances when the matching calibration key is pressed. Reachable
; any time from the tray: "Setup wizard...". Auto-opens once on first run.
WizardGui := 0
WizardStepIndex := 1
WizardProgressCtl := 0
WizardTitleCtl := 0
WizardBodyCtl := 0
WizardHintCtl := 0
WizardBackBtn := 0
WizardNextBtn := 0

WizardSteps() {
    global Keys
    return [
        Map("id", "welcome", "wait", "", "title", "Welcome aboard!",
            "body", "This one-time setup teaches the importer where things sit on YOUR screen."
            . " It takes about a minute.`n`nBefore we start:`n"
            . "  - Path of Exile in Windowed or Windowed Fullscreen`n"
            . "  - The Voyage board open, chart panel visible, not scrolled`n"
            . "  - The solver site open in your browser (click the page once)`n`n"
            . "This window stays on top - drag it anywhere out of the way."),
        Map("id", "grid-tl", "wait", "GridTL", "title", "Chart grid - corner 1 of 2",
            "body", "In PoE, hover your mouse over the CENTRE of the TOP-LEFT chart"
            . " in the chart panel.`n`nThen press " KeyLabel(Keys["WizardSet"]) " (keep the mouse still)."),
        Map("id", "grid-br", "wait", "GridBR", "title", "Chart grid - corner 2 of 2",
            "body", "Now hover the CENTRE of the BOTTOM-RIGHT cell of the chart grid"
            . " - the far corner of the 6-wide grid, even if that slot is empty.`n`n"
            . "Then press " KeyLabel(Keys["WizardSet"]) "."),
        Map("id", "border-exact", "wait", "ExactDone", "title", "Board borders - all 12 points",
            "body", "Now teach it exactly where each of the 12 border modifiers sits.`n`n"
            . "Recording starts automatically.`n`n"
            . "Hover the modifier named below and press " KeyLabel(Keys["WizardSet"]) "."
            . " The script names each of the 12 in turn."),
        Map("id", "preview", "wait", "BorderPreview", "title", "Optional: preview the aim",
            "body", "Press " KeyLabel(Keys["WizardSet"]) " to watch the mouse visit all 12"
            . " border points slowly - no OCR, no clipboard, just a dry run.`n`n"
            . "If a point misses its pill, rerun the wizard from the tray and redo the border step."
            . "`n`nOr just click Skip."),
        Map("id", "done", "wait", "", "title", "You're set!",
            "body", "Daily use:`n"
            . "  - " KeyLabel(Keys["RunSweep"]) "  =  full import (charts + border OCR)`n"
            . "  - " KeyLabel(Keys["BordersOnly"]) "  =  rescan just the 12 borders`n"
            . "  - " KeyLabel(Keys["Abort"]) "  =  abort anything`n`n"
            . "Tray icon -> Keybinds... to rebind any of these.`n"
            . "Tray icon -> Setup wizard... to run this again."),
    ]
}

StartWizard(*) {
    global WizardGui, WizardStepIndex, WizardProgressCtl, WizardTitleCtl
    global WizardBodyCtl, WizardHintCtl, WizardBackBtn, WizardNextBtn
    if IsObject(WizardGui) {
        WizardStepIndex := 1
        WizardRender()
        WizardGui.Show()
        ApplyKeybinds()
        SetTimer WizardUpdateStatus, 800
        return
    }
    WizardGui := Gui("+AlwaysOnTop +ToolWindow", "Voyage Importer - Setup")
    WizardGui.BackColor := "16130E"
    WizardGui.SetFont("s9 c9A8F76", "Segoe UI")
    WizardProgressCtl := WizardGui.Add("Text", "xm w400", "")
    WizardGui.SetFont("s12 cE7D7AB Bold", "Segoe UI")
    WizardTitleCtl := WizardGui.Add("Text", "xm w400", "")
    WizardGui.SetFont("s10 cD8CBB0 Norm", "Segoe UI")
    WizardBodyCtl := WizardGui.Add("Text", "xm w400 h170", "")
    WizardGui.SetFont("s10 c7FD98F", "Segoe UI")
    WizardHintCtl := WizardGui.Add("Text", "xm w400 h48", "")
    WizardGui.SetFont("s10 cD8CBB0", "Segoe UI")
    WizardBackBtn := WizardGui.Add("Button", "xm w90", "Back")
    WizardNextBtn := WizardGui.Add("Button", "x+8 w130 Default", "Next")
    closeBtn := WizardGui.Add("Button", "x+8 w90", "Close")
    WizardBackBtn.OnEvent("Click", (*) => WizardMove(-1))
    WizardNextBtn.OnEvent("Click", (*) => WizardMove(1))
    closeBtn.OnEvent("Click", (*) => WizardFinish(false))
    WizardGui.OnEvent("Close", (*) => (WizardFinish(false), true))
    WizardStepIndex := 1
    WizardRender()
    WizardGui.Show("x24 y24")
    ApplyKeybinds()
    SetTimer WizardUpdateStatus, 800
}

WizardRender() {
    global WizardStepIndex, WizardProgressCtl, WizardTitleCtl, WizardBodyCtl
    global WizardHintCtl, WizardBackBtn, WizardNextBtn, Keys
    steps := WizardSteps()
    if (WizardStepIndex < 1)
        WizardStepIndex := 1
    if (WizardStepIndex > steps.Length)
        WizardStepIndex := steps.Length
    step := steps[WizardStepIndex]
    WizardProgressCtl.Value := "Step " WizardStepIndex " of " steps.Length
    WizardTitleCtl.Value := step["title"]
    WizardBodyCtl.Value := step["body"]
    if (step["id"] = "border-exact")
        WizardHintCtl.Value := WizardExactHint()
    else if (step["wait"] != "")
        WizardHintCtl.Value := "-> Waiting for " KeyLabel(Keys["WizardSet"]) " ... (auto-advances, or click Skip)"
    else if (step["id"] = "welcome")
        WizardUpdateStatus()
    else
        WizardHintCtl.Value := "Have a profitable voyage!"
    WizardBackBtn.Enabled := WizardStepIndex > 1
    WizardNextBtn.Text := (WizardStepIndex = steps.Length) ? "Finish"
        : (step["wait"] != "") ? "Skip" : "Next"
}

WizardUpdateStatus() {
    global WizardGui, WizardStepIndex, WizardHintCtl, PoeWinTitle, BrowserWinTitle
    if !IsObject(WizardGui) || !WinExist("ahk_id " WizardGui.Hwnd)
        return
    steps := WizardSteps()
    if (steps[WizardStepIndex]["id"] != "welcome")
        return
    poe := WinExist(PoeWinTitle) ? "OK - found" : "MISSING - start PoE (windowed)"
    web := WinExist(BrowserWinTitle) ? "OK - found" : "MISSING - open the solver site"
    WizardHintCtl.Value := "Path of Exile window:  " poe "`nSolver browser tab:     " web
}

WizardMove(delta) {
    global WizardStepIndex, ExactBorderNext
    steps := WizardSteps()
    if (delta > 0 && WizardStepIndex >= steps.Length) {
        WizardFinish(true)
        return
    }
    WizardStepIndex += delta
    if (WizardStepIndex < 1)
        WizardStepIndex := 1
    if (WizardStepIndex > steps.Length)
        WizardStepIndex := steps.Length
    ; entering the border step starts the 12-point recording automatically
    if (steps[WizardStepIndex]["id"] = "border-exact") {
        ClearExactBorderCalibration()
        ExactBorderNext := 1
    }
    WizardRender()
}

WizardExactHint() {
    global ExactBorderNext, ExactBorderPoints, Keys
    if (ExactBorderNext < 1)
        return "-> Hover the first modifier and press " KeyLabel(Keys["WizardSet"]) " to begin"
    return "Saved " ExactBorderPoints.Length "/12 - next: " BorderPointLabel(ExactBorderNext)
        . "`nHover it and press " KeyLabel(Keys["WizardSet"]) "."
}

; one key does every wizard "set": what it sets depends on the current step
WizardSetPressed(*) {
    global WizardStepIndex
    if !WizardActive()
        return
    steps := WizardSteps()
    if (WizardStepIndex < 1 || WizardStepIndex > steps.Length)
        return
    id := steps[WizardStepIndex]["id"]
    if (id = "grid-tl")
        SetGridTopLeft()
    else if (id = "grid-br")
        SetGridBottomRight()
    else if (id = "border-exact")
        SaveExactPoint()
    else if (id = "preview")
        PreviewBorders()
    else
        Flash "Nothing to set on this step - use the buttons.", 2000
}

WizardOnAction(action) {
    global WizardGui, WizardStepIndex
    if !IsObject(WizardGui) || !WinExist("ahk_id " WizardGui.Hwnd)
        return
    steps := WizardSteps()
    if (WizardStepIndex < 1 || WizardStepIndex > steps.Length)
        return
    step := steps[WizardStepIndex]
    if (step["wait"] = action) {
        WizardMove(1)
        return
    }
    ; progress ticks inside the 12-point step refresh the hint, not the step
    if (step["id"] = "border-exact" && (action = "ExactStart" || action = "ExactSave"))
        WizardRender()
    ; finishing the quick 2-corner mode also satisfies the border step
    if (step["id"] = "border-exact" && action = "BorderBR" && BoardCalibrated())
        WizardMove(1)
}

WizardFinish(completed) {
    global WizardGui, IniFile, Keys
    SetTimer WizardUpdateStatus, 0
    if IsObject(WizardGui)
        WizardGui.Hide()
    ApplyKeybinds()
    IniWrite 1, IniFile, "wizard", "Seen"
    if completed
        Flash "Setup complete. " KeyLabel(Keys["RunSweep"]) " runs the import!", 4000
}

A_TrayMenu.Insert("2&", "Setup wizard...", StartWizard)
; the wizard must be seen once - even with calibration already in the ini.
; Completing it OR closing/skipping it sets the Seen flag; after that it only
; opens from the tray menu.
if (IniRead(IniFile, "wizard", "Seen", "0") = "0")
    SetTimer StartWizard, -600
; ------------------------------------------

Flash(text, ms := 1400) {
    ToolTip text
    SetTimer () => ToolTip(), -ms
}

CellPos(row, col) {
    global TLx, TLy, BRx, BRy, GridCols, GridRows
    dx := (GridCols > 1) ? (BRx - TLx) / (GridCols - 1) : 0
    dy := (GridRows > 1) ? (BRy - TLy) / (GridRows - 1) : 0
    return [Round(TLx + col * dx), Round(TLy + row * dy)]
}

Calibrated() => (TLx != 0 && TLy != 0 && BRx != 0 && BRy != 0)

IsChartText(text) {
    return InStr(text, "Item Class: Chart")
        || InStr(text, "아이템 종류: 해도")
}

ExactBordersCalibrated() {
    global ExactBorderPoints
    return ExactBorderPoints.Length = 12
}

BoardCalibrated() {
    global BorderTLx, BorderTLy, BorderBRx, BorderBRy
    return ExactBordersCalibrated()
        || (BorderTLx != 0 && BorderTLy != 0 && BorderBRx > BorderTLx && BorderBRy > BorderTLy)
}

BorderPointLabel(index) {
    labels := [
        "TOP - left", "TOP - middle", "TOP - right",
        "RIGHT - top", "RIGHT - middle", "RIGHT - bottom",
        "BOTTOM - left", "BOTTOM - middle", "BOTTOM - right",
        "LEFT - top", "LEFT - middle", "LEFT - bottom"
    ]
    return (index >= 1 && index <= labels.Length) ? labels[index] : "unknown"
}

ClearExactBorderCalibration() {
    global ExactBorderPoints, ExactBorderNext, IniFile
    ExactBorderPoints := []
    ExactBorderNext := 0
    try IniDelete IniFile, "board-exact"
}

BorderPoints() {
    global BorderTLx, BorderTLy, BorderBRx, BorderBRy, ExactBorderPoints
    if ExactBordersCalibrated()
        return ExactBorderPoints

    ; The quick calibration defines the outer rectangle. Each modifier sits at the centre
    ; of one of the three equal edge segments, never outside that rectangle.
    cellW := (BorderBRx - BorderTLx) / 3
    cellH := (BorderBRy - BorderTLy) / 3
    points := []

    ; indices 0-2: top, left to right
    Loop 3
        points.Push([Round(BorderTLx + (A_Index - 0.5) * cellW), BorderTLy])
    ; indices 3-5: right, top to bottom
    Loop 3
        points.Push([BorderBRx, Round(BorderTLy + (A_Index - 0.5) * cellH)])
    ; indices 6-8: bottom, left to right
    Loop 3
        points.Push([Round(BorderTLx + (A_Index - 0.5) * cellW), BorderBRy])
    ; indices 9-11: left, top to bottom
    Loop 3
        points.Push([BorderTLx, Round(BorderTLy + (A_Index - 0.5) * cellH)])

    return points
}

OcrPowerShell() {
    return "
(
param(
    [int]$Index = -1,
    [int]$WindowLeft = 0,
    [int]$WindowTop = 0,
    [int]$WindowWidth = 0,
    [int]$WindowHeight = 0,
    [string]$ImagePath = '',
    [string]$Session = '',
    [Parameter(Mandatory = $true)][string]$OutputPath)

$ErrorActionPreference = 'Stop'
trap {
    $utf8 = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText(
        $OutputPath,
        ('OCR HELPER ERROR: ' + $_.Exception.ToString()),
        $utf8)
    exit 1
}
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.WindowsRuntime

Add-Type -ReferencedAssemblies 'System.Drawing' -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class VoyageOcrImage
{
    public static void Prepare(string sourcePath, string outputPath)
    {
        using (var original = new Bitmap(sourcePath))
        using (var source = new Bitmap(original.Width, original.Height, PixelFormat.Format32bppArgb))
        {
            using (var graphics = Graphics.FromImage(source))
            {
                graphics.DrawImageUnscaled(original, 0, 0);
            }

            var rect = new Rectangle(0, 0, source.Width, source.Height);
            var sourceData = source.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            var sourceStride = Math.Abs(sourceData.Stride);
            var sourceBytes = new byte[sourceStride * source.Height];
            Marshal.Copy(sourceData.Scan0, sourceBytes, 0, sourceBytes.Length);
            source.UnlockBits(sourceData);

            using (var mask = new Bitmap(source.Width, source.Height, PixelFormat.Format24bppRgb))
            {
                var maskData = mask.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format24bppRgb);
                var maskStride = Math.Abs(maskData.Stride);
                var maskBytes = new byte[maskStride * mask.Height];
                for (var i = 0; i < maskBytes.Length; i++)
                {
                    maskBytes[i] = 255;
                }

                for (var y = 0; y < source.Height; y++)
                {
                    for (var x = 0; x < source.Width; x++)
                    {
                        var sourceOffset = y * sourceStride + x * 4;
                        var blue = sourceBytes[sourceOffset];
                        var green = sourceBytes[sourceOffset + 1];
                        var red = sourceBytes[sourceOffset + 2];

                        // PoE board modifiers use lavender text. Keep its
                        // anti-aliased pixels and discard inventory levels,
                        // icons, scenery and other white UI text.
                        var isModifierText =
                            blue >= 130 &&
                            blue - red >= 30 &&
                            blue - green >= 30 &&
                            Math.Abs(red - green) <= 18;
                        if (!isModifierText)
                        {
                            continue;
                        }

                        var maskOffset = y * maskStride + x * 3;
                        maskBytes[maskOffset] = 0;
                        maskBytes[maskOffset + 1] = 0;
                        maskBytes[maskOffset + 2] = 0;
                    }
                }

                Marshal.Copy(maskBytes, 0, maskData.Scan0, maskBytes.Length);
                mask.UnlockBits(maskData);

                var scale = Math.Min(2.0, 6000.0 / Math.Max(mask.Width, mask.Height));
                var scaledWidth = (int)Math.Round(mask.Width * scale);
                var scaledHeight = (int)Math.Round(mask.Height * scale);
                const int padding = 64;
                using (var prepared = new Bitmap(
                    scaledWidth + 2 * padding,
                    scaledHeight + 2 * padding,
                    PixelFormat.Format24bppRgb))
                {
                    using (var graphics = Graphics.FromImage(prepared))
                    {
                        graphics.Clear(Color.White);
                        graphics.InterpolationMode = InterpolationMode.NearestNeighbor;
                        graphics.PixelOffsetMode = PixelOffsetMode.Half;
                        graphics.DrawImage(
                            mask,
                            new Rectangle(padding, padding, scaledWidth, scaledHeight));
                    }
                    prepared.Save(outputPath, ImageFormat.Png);
                }
            }
        }
    }
}
'@

[void][Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
[void][Windows.Storage.FileAccessMode, Windows.Storage, ContentType = WindowsRuntime]
[void][Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
[void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
[void][Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
[void][Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
[void][Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
[void][Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType = WindowsRuntime]

function Await-Result {
    param(
        [Parameter(Mandatory = $true)]$AsyncOperation,
        [Parameter(Mandatory = $true)][Type]$ResultType)
    $method = [System.WindowsRuntimeSystemExtensions].GetMethods() |
        Where-Object {
            $_.Name -eq 'AsTask' -and
            $_.IsGenericMethod -and
            $_.GetParameters().Count -eq 1
        } |
        Select-Object -First 1
    $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($AsyncOperation))
    $task.Wait()
    return $task.Result
}

function New-OcrEngine {
    # Prefer an installed English recognizer because Path of Exile tooltips
    # are English. Do not require en-US specifically: many Windows installs
    # only have en-GB, Polish, or another Latin-script OCR language.
    $available = @([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages)
    $english = @($available | Where-Object {
        $_.LanguageTag -eq 'en-US' -or $_.LanguageTag -like 'en-*'
    } | Sort-Object {
        if ($_.LanguageTag -eq 'en-US') { 0 } else { 1 }
    })

    foreach ($language in $english) {
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
        if ($null -ne $engine) {
            return $engine
        }
    }

    # Fall back to the Windows profile language (for example pl-PL). The
    # border matcher tolerates small OCR errors, and Latin-script recognizers
    # can still read the English tooltip text well enough for matching.
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if ($null -ne $engine) {
        return $engine
    }

    # A profile language may not be in the installed OCR list. Use any
    # recognizer as a final fallback rather than rejecting a usable setup.
    foreach ($language in $available) {
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
        if ($null -ne $engine) {
            return $engine
        }
    }

    throw ('Windows OCR has no installed language. Open an elevated Command Prompt and run: ' +
        'DISM /Online /Add-Capability /CapabilityName:Language.OCR~~~en-US~0.0.1.0')
}

function Invoke-OcrFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$Engine)

    $file = Await-Result ([Windows.Storage.StorageFile]::GetFileFromPathAsync($Path)) ([Windows.Storage.StorageFile])
    $stream = Await-Result ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    try {
        $decoder = Await-Result ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $bitmap = Await-Result ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        try {
            $result = Await-Result ($Engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
            $lines = @($result.Lines | ForEach-Object { $_.Text })
            if ($lines.Count -gt 0) { return $lines -join [Environment]::NewLine }
            return $result.Text
        } finally {
            if ($null -ne $bitmap) { $bitmap.Dispose() }
        }
    } finally {
        $stream.Dispose()
    }
}

function Read-OcrLines {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$engine)
    $preparedPath = Join-Path $env:TEMP "voyage-ocr-filtered-$PID-$([Guid]::NewGuid().ToString('N')).png"
    [VoyageOcrImage]::Prepare($Path, $preparedPath)

    try {
        $text = Invoke-OcrFile $preparedPath $engine

        # The lavender-only mask can occasionally be empty even though the
        # tooltip is visible. Retry the original screenshot before declaring
        # the border unreadable.
        if ([string]::IsNullOrWhiteSpace($text)) {
            $text = Invoke-OcrFile $Path $engine
        }
        if ([string]::IsNullOrWhiteSpace($text)) {
            throw 'Windows OCR returned no text after filtered and unfiltered scans.'
        }
        return $text
    } finally {
        Remove-Item -LiteralPath $preparedPath -Force -ErrorAction SilentlyContinue
    }
}

function Add-Block {
    param(
        [Parameter(Mandatory = $true)][System.Text.StringBuilder]$Builder,
        [Parameter(Mandatory = $true)][int]$Index,
        [Parameter(Mandatory = $true)][string]$Text)
    [void]$Builder.AppendLine("=== VOYAGE BORDER $Index ===")
    [void]$Builder.AppendLine($Text)
    [void]$Builder.AppendLine('=== END VOYAGE BORDER ===')
}

$utf8 = [System.Text.UTF8Encoding]::new($false)

function Write-Atomic {
    param([string]$Path, [string]$Text)
    $tmp = "$Path.tmp"
    [System.IO.File]::WriteAllText($tmp, $Text, $utf8)
    Move-Item -LiteralPath $tmp -Destination $Path -Force
}

function Get-BorderBlock {
    param([int]$Index, [int]$Left, [int]$Top, [int]$Width, [int]$Height, $Engine)
    $builder = [System.Text.StringBuilder]::new()
    $png = Join-Path $env:TEMP "voyage-border-$PID-$Index.png"
    try {
        if ($Width -le 0 -or $Height -le 0) {
            throw 'Invalid Path of Exile window size.'
        }
        $image = [System.Drawing.Bitmap]::new($Width, $Height)
        $graphics = [System.Drawing.Graphics]::FromImage($image)
        try {
            $graphics.CopyFromScreen($Left, $Top, 0, 0, $image.Size)
            $image.Save($png, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $graphics.Dispose()
            $image.Dispose()
        }
        Add-Block $builder $Index (Read-OcrLines $png $Engine)
    } catch {
        Add-Block $builder $Index ("OCR ERROR: " + $_.Exception.Message)
    } finally {
        Remove-Item -LiteralPath $png -Force -ErrorAction SilentlyContinue
    }
    return $builder.ToString()
}

if ($ImagePath) {
    $engine = New-OcrEngine
    $builder = [System.Text.StringBuilder]::new()
    Add-Block $builder 0 (Read-OcrLines $ImagePath $engine)
    [System.IO.File]::WriteAllText($OutputPath, $builder.ToString(), $utf8)
    exit 0
}

if (-not $Session) {
    throw 'Server mode needs -Session.'
}

# Server mode: the expensive parts (C# compile above, OCR engine here) happen
# ONCE, then each border is a quick file-signalled capture + recognition.
$engine = New-OcrEngine
Write-Atomic $OutputPath 'READY'
$cmdFile = "$Session.cmd"
while ($true) {
    # transient file contention (the AutoHotkey side moving/reading files at
    # the same instant) must never terminate the server - swallow and retry
    try {
        if (-not (Test-Path -LiteralPath $cmdFile)) {
            Start-Sleep -Milliseconds 40
            continue
        }
        $line = ([System.IO.File]::ReadAllText($cmdFile, $utf8)).Trim()
        Remove-Item -LiteralPath $cmdFile -Force -ErrorAction SilentlyContinue
        if ($line -eq 'quit') { break }
        $parts = $line.Split('|')
        if ($parts[0] -ne 'capture' -or $parts.Count -lt 6) { continue }
        $idx = [int]$parts[1]
        $block = Get-BorderBlock -Index $idx -Left ([int]$parts[2]) -Top ([int]$parts[3]) -Width ([int]$parts[4]) -Height ([int]$parts[5]) -Engine $engine
        Write-Atomic "$Session-res-$idx.txt" $block
    } catch {
        Start-Sleep -Milliseconds 60
    }
}
)"
}

EnsureOcrHelper() {
    global OcrHelper
    try FileDelete OcrHelper
    FileAppend OcrPowerShell(), OcrHelper, "UTF-8"
}

RunOcrHelper(arguments, cancellable := true) {
    global OcrHelper, OcrOutput, OcrPid, OcrTimeout, Running
    try FileDelete OcrOutput
    EnsureOcrHelper()
    quote := Chr(34)
    command := "powershell.exe -NoProfile -ExecutionPolicy Bypass -File "
        . quote OcrHelper quote " " arguments " -OutputPath " quote OcrOutput quote
    Run command, , "Hide", &OcrPid
    deadline := A_TickCount + OcrTimeout * 1000
    while ProcessExist(OcrPid) {
        if (cancellable && !Running) {
            ProcessClose OcrPid
            OcrPid := 0
            return ""
        }
        if (A_TickCount > deadline) {
            ProcessClose OcrPid
            OcrPid := 0
            MsgBox "Windows OCR timed out. Try again, or raise OcrTimeout in the script."
            return ""
        }
        Sleep 100
    }
    OcrPid := 0
    if !FileExist(OcrOutput)
        return ""
    return FileRead(OcrOutput, "UTF-8")
}

StartOcrServer() {
    global OcrHelper, OcrSession, OcrPid
    if (OcrPid && ProcessExist(OcrPid))
        return
    try FileDelete OcrSession ".ready"
    try FileDelete OcrSession ".cmd"
    EnsureOcrHelper()
    quote := Chr(34)
    command := "powershell.exe -NoProfile -ExecutionPolicy Bypass -File "
        . quote OcrHelper quote " -Session " quote OcrSession quote
        . " -OutputPath " quote OcrSession ".ready" quote
    Run command, , "Hide", &OcrPid
}

WaitOcrReady(timeoutMs) {
    global OcrSession, OcrPid, Running
    deadline := A_TickCount + timeoutMs
    while (A_TickCount < deadline) {
        if !Running
            return ""
        if FileExist(OcrSession ".ready")
            return Trim(FileRead(OcrSession ".ready", "UTF-8"), " `t`r`n")
        if !ProcessExist(OcrPid)
            return "OCR HELPER ERROR: the helper exited before becoming ready."
        Sleep 50
    }
    return "OCR HELPER ERROR: timed out waiting for Windows OCR to initialize."
}

OcrSendCommand(text) {
    global OcrSession
    try FileDelete OcrSession ".cmd.tmp"
    FileAppend text, OcrSession ".cmd.tmp", "UTF-8"
    try FileMove OcrSession ".cmd.tmp", OcrSession ".cmd", 1
}

OcrHelperLastWords() {
    global OcrSession
    if FileExist(OcrSession ".ready")
        return Trim(FileRead(OcrSession ".ready", "UTF-8"), " `t`r`n")
    return "no error output was left behind"
}

OcrCaptureBorder(index, winX, winY, winW, winH) {
    global OcrSession, OcrPid, OcrTimeout, Running
    Loop 2 { ; a dead helper is restarted once, then the capture is retried
        resFile := OcrSession "-res-" index ".txt"
        try FileDelete resFile
        OcrSendCommand("capture|" index "|" winX "|" winY "|" winW "|" winH)
        deadline := A_TickCount + OcrTimeout * 1000
        helperDied := false
        while (A_TickCount < deadline) {
            if !Running
                return ""
            if FileExist(resFile) {
                block := FileRead(resFile, "UTF-8")
                try FileDelete resFile
                return block
            }
            if !ProcessExist(OcrPid) {
                helperDied := true
                break
            }
            Sleep 40
        }
        if !helperDied
            return "=== VOYAGE BORDER " index " ===`nOCR ERROR: capture timed out.`n=== END VOYAGE BORDER ==="
        reason := OcrHelperLastWords()
        if (A_Index = 2)
            return "=== VOYAGE BORDER " index " ===`nOCR ERROR: helper died twice. Last error: " reason "`n=== END VOYAGE BORDER ==="
        ; restart the helper and retry this border once
        OcrPid := 0
        StartOcrServer()
        ready := WaitOcrReady(45000)
        if (ready != "READY")
            return "=== VOYAGE BORDER " index " ===`nOCR ERROR: helper restart failed: " ready ". Original error: " reason "`n=== END VOYAGE BORDER ==="
    }
}

StopOcrServer() {
    global OcrSession, OcrPid
    if (OcrPid && ProcessExist(OcrPid)) {
        OcrSendCommand("quit")
        deadline := A_TickCount + 2000
        while (ProcessExist(OcrPid) && A_TickCount < deadline)
            Sleep 50
        if ProcessExist(OcrPid)
            try ProcessClose OcrPid
    }
    OcrPid := 0
    try FileDelete OcrSession ".cmd"
    try FileDelete OcrSession ".ready"
}

ScanBorders() {
    global PoeWinTitle, BorderHoverDelay, BorderOcrAttempts, Running
    WinGetPos &winX, &winY, &winW, &winH, PoeWinTitle
    ; one persistent helper per sweep: PowerShell boots and compiles while we
    ; hover the first border, then every border is a quick capture + read
    StartOcrServer()
    result := ""
    ready := ""
    for index, point in BorderPoints() {
        if !Running
            break
        block := ""
        Loop BorderOcrAttempts {
            if !Running
                break
            attempt := A_Index
            ToolTip "Moving to board border " index "/12..."
                . (attempt > 1 ? "`nRetrying empty OCR scan..." : "")
            MouseMove point[1], point[2], 0
            Sleep BorderHoverDelay + (attempt - 1) * 200
            ToolTip()
            Sleep 30
            if (ready = "") {
                ready := WaitOcrReady(45000)
                if (ready = "")
                    break
                if (ready != "READY") {
                    StopOcrServer()
                    MsgBox "Border OCR unavailable:`n`n" ready
                    return ""
                }
            }
            block := OcrCaptureBorder(index - 1, winX, winY, winW, winH)
            if !InStr(block, "Windows OCR returned no text")
                break
        }
        if (block != "")
            result .= (result = "" ? "" : "`n") block
    }
    StopOcrServer()
    return result
}

; Developer smoke-test: run the embedded Windows OCR helper against an image.
if A_Args.Length >= 2 && A_Args[1] = "--ocr-file" {
    quote := Chr(34)
    result := RunOcrHelper("-ImagePath " quote A_Args[2] quote, false)
    FileAppend result, "*", "UTF-8"
    ExitApp
}

; ---- capture the outer board-border rectangle (default Shift+F7 / Shift+F8) ----
SetBorderTopLeft(*) {
    global
    WizardOnAction("BorderTL")
    ClearExactBorderCalibration()
    MouseGetPos &x, &y
    BorderTLx := x, BorderTLy := y
    IniWrite BorderTLx, IniFile, "board", "TopLeftX"
    IniWrite BorderTLy, IniFile, "board", "TopY"
    Flash "Top-left board border set: " BorderTLx ", " BorderTLy
}
SetBorderBottomRight(*) {
    global
    ClearExactBorderCalibration()
    MouseGetPos &x, &y
    BorderBRx := x, BorderBRy := y
    IniWrite BorderBRx, IniFile, "board", "BottomRightX"
    IniWrite BorderBRy, IniFile, "board", "BottomY"
    WizardOnAction("BorderBR")
    Flash "Bottom-right board border set: " BorderBRx ", " BorderBRy
}

; ---- guided exact calibration of all 12 modifiers (default Ctrl+F5 / Ctrl+F6) ----
StartExactCalibration(*) {
    global
    ClearExactBorderCalibration()
    ExactBorderNext := 1
    WizardOnAction("ExactStart")
    Flash "Exact border calibration started."
        . "`nHover 1/12: " BorderPointLabel(ExactBorderNext)
        . "`nPress " KeyLabel(Keys["WizardSet"]) " to save it.", 5000
}

SaveExactPoint(*) {
    global
    if (ExactBorderNext < 1 || ExactBorderNext > 12) {
        Flash "Border recording isn't active - open the wizard's border step.", 3500
        return
    }

    MouseGetPos &x, &y
    savedIndex := ExactBorderNext
    ExactBorderPoints.Push([x, y])
    IniWrite x, IniFile, "board-exact", "Point" savedIndex "X"
    IniWrite y, IniFile, "board-exact", "Point" savedIndex "Y"
    ExactBorderNext++

    if (ExactBorderNext > 12) {
        ExactBorderNext := 0
        WizardOnAction("ExactDone")
        Flash "Exact border calibration complete: 12/12.", 4000
        return
    }

    WizardOnAction("ExactSave")
    Flash "Saved " savedIndex "/12: " BorderPointLabel(savedIndex)
        . "`nNext " ExactBorderNext "/12: " BorderPointLabel(ExactBorderNext)
        . "`nHover it and press " KeyLabel(Keys["WizardSet"]) ".", 5000
}

; ---- preview border positions without OCR (default Ctrl+F4) ----
PreviewBorders(*) {
    global
    WizardOnAction("BorderPreview")
    if Running {
        Flash "A scan or preview is already running.", 2500
        return
    }
    if !BoardCalibrated() {
        MsgBox "Borders aren't calibrated yet - finish the wizard's border step first."
        return
    }
    if !WinExist(PoeWinTitle) {
        MsgBox "Can't find the PoE window (" PoeWinTitle ")."
        return
    }

    Running := true
    WinActivate PoeWinTitle
    if !WinWaitActive(PoeWinTitle, , 2) {
        Running := false
        Flash "Couldn't focus PoE.", 3000
        return
    }

    for index, point in BorderPoints() {
        if !Running
            break
        MouseMove point[1], point[2], 0
        ToolTip "Border preview " index "/12"
            . "`n" BorderPointLabel(index)
            . "`n(" KeyLabel(Keys["Abort"]) " to abort)", 20, 20
        Sleep BorderPreviewDelay
    }

    completed := Running
    Running := false
    ToolTip()
    if completed
        Flash "Border preview complete. No OCR was run.", 3500
}

; ---- capture the chart grid corners (default F7 / F8) ----
SetGridTopLeft(*) {
    global
    WizardOnAction("GridTL")
    MouseGetPos &x, &y
    TLx := x, TLy := y
    IniWrite TLx, IniFile, "grid", "TLx"
    IniWrite TLy, IniFile, "grid", "TLy"
    Flash "Top-left set: " TLx ", " TLy
}
SetGridBottomRight(*) {
    global
    WizardOnAction("GridBR")
    MouseGetPos &x, &y
    BRx := x, BRy := y
    IniWrite BRx, IniFile, "grid", "BRx"
    IniWrite BRy, IniFile, "grid", "BRy"
    Flash "Bottom-right set: " BRx ", " BRy
}

; ---- abort (default F10) ----
AbortAll(*) {
    global Running, OcrPid, ExactBorderNext
    Running := false
    ExactBorderNext := 0
    if OcrPid && ProcessExist(OcrPid) {
        ProcessClose OcrPid
        OcrPid := 0
    }
    Flash "Aborting..."
}

; ---- borders-only import: OCR the 12 borders, paste, done (default Shift+F9) ----
RunBordersOnly(*) {
    global
    if Running {
        Flash "A scan is already running.", 2500
        return
    }
    if !BoardCalibrated() {
        MsgBox "Borders aren't calibrated yet. Right-click the tray icon -> Setup wizard..."
        return
    }
    if !WinExist(PoeWinTitle) {
        MsgBox "Can't find the PoE window (" PoeWinTitle ")."
        return
    }
    if !WinExist(BrowserWinTitle) {
        MsgBox "Can't find a window titled '" BrowserWinTitle "'.`nOpen the solver and make it the active browser tab."
        return
    }

    Running := true
    WinActivate PoeWinTitle
    if !WinWaitActive(PoeWinTitle, , 2) {
        Running := false
        Flash "Couldn't focus PoE.", 3000
        return
    }
    Sleep ActivateDelay

    ToolTip "Reading 12 board borders with Windows OCR..."
        . "`nThis can take 15-30 seconds on a 4K screen."
        . "`n(" KeyLabel(Keys["Abort"]) " to abort)"
    borderBlob := ScanBorders()
    ToolTip()

    if (Running && borderBlob != "") {
        A_Clipboard := borderBlob
        ClipWait(1)
        WinActivate BrowserWinTitle
        if WinWaitActive(BrowserWinTitle, , 2) {
            Sleep ActivateDelay
            Send "^v"
            Sleep PasteDelay
        } else {
            Running := false
            Flash "Scanned the borders but couldn't focus the browser to paste.", 4000
            return
        }
    }

    completed := Running
    Running := false
    Flash completed
        ? (borderBlob != "" ? "Done. Sent 12 border OCR scans." : "Border OCR returned nothing - check calibration.")
        : "Aborted.", 5000
}

; ---- the real import sweep (default F9) ----
RunSweep(*) {
    global
    if !Calibrated() {
        MsgBox "Not calibrated yet. Right-click the tray icon -> Setup wizard..."
        return
    }
    if !WinExist(PoeWinTitle) {
        MsgBox "Can't find the PoE window (" PoeWinTitle ")."
        return
    }
    if !WinExist(BrowserWinTitle) {
        MsgBox "Can't find a window titled '" BrowserWinTitle "'.`nOpen the solver and make it the active browser tab."
        return
    }

    Running := true
    copied := 0, skipped := 0, blob := "", borderBlob := ""

    ; ---- Phase 1: copy every chart while staying in PoE ----
    WinActivate PoeWinTitle
    if !WinWaitActive(PoeWinTitle, , 2) {
        Running := false
        Flash "Couldn't focus PoE.", 3000
        return
    }
    Sleep ActivateDelay

    Loop GridRows {
        if !Running
            break
        r := A_Index - 1
        Loop GridCols {
            if !Running
                break
            c := A_Index - 1
            p := CellPos(r, c)
            A_Clipboard := ""
            MouseMove p[1], p[2], 0
            Sleep HoverDelay
            Send "^c"
            if !ClipWait(ClipTimeout) {
                skipped++                 ; empty slot - nothing copied
                continue
            }
            clip := Trim(A_Clipboard, " `t`r`n")
            if !IsChartText(clip) {
                skipped++                 ; not a Chart item
                continue
            }
            ; Keep identical item text: separate physical Charts are separate
            ; solver pieces even when every copied property is the same.
            blob .= (blob = "" ? "" : "`n") clip
            copied++
            ToolTip "Copying... row " (r+1) " col " (c+1)
                . "`ncharts " copied "   skipped " skipped
                . "`n(" KeyLabel(Keys["Abort"]) " to abort)"
        }
    }

    ; ---- Phase 2: OCR the 12 board-border modifier tooltips ----
    if Running && BoardCalibrated() {
        ToolTip "Reading 12 board borders with Windows OCR..."
            . "`nThis can take 15-30 seconds on a 4K screen."
            . "`n(" KeyLabel(Keys["Abort"]) " to abort)"
        borderBlob := ScanBorders()
    }

    ; ---- Phase 3: one switch, one paste of the whole batch ----
    if Running && (copied > 0 || borderBlob != "") {
        payload := blob
        if (payload != "" && borderBlob != "")
            payload .= "`n"
        payload .= borderBlob
        A_Clipboard := payload
        ClipWait(1)
        WinActivate BrowserWinTitle
        if WinWaitActive(BrowserWinTitle, , 2) {
            Sleep ActivateDelay
            Send "^v"
            Sleep PasteDelay
        } else {
            Running := false
            Flash "Copied " copied " charts but couldn't focus the browser to paste.", 4000
            return
        }
    }

    Running := false
    borderNote := BoardCalibrated()
        ? (borderBlob != "" ? " + 12 border OCR scans" : " (border OCR failed)")
        : " (borders skipped: run the tray Setup wizard)"
    Flash "Done. Sent " copied " charts" borderNote
        . "; skipped " skipped " empty/non-chart cells.", 6000
}
