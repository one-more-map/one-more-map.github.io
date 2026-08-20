#Requires AutoHotkey v2.0
#SingleInstance Force
Persistent
CoordMode "ToolTip", "Screen"

; =====================================================================
;  Allflame Voyage - chart & border collector  (AutoHotkey v2)
;
;  This tool sends ZERO inputs to the game. Ever. No keystrokes, no
;  clicks, no mouse movement, no window switching. You press every key
;  yourself; the collector only listens - to the clipboard you copied
;  to, and to a screenshot it takes passively while YOU hold Alt.
;  A test in the site's repo fails the build if any input-sending code
;  ever appears in this file.
;
;  F7 - chart copy mode
;   1. Press F7 - copy mode ON, a counter appears.
;   2. In PoE, hover each chart and press Ctrl+C yourself. The counter
;      ticks up per chart (non-charts and double-copies are ignored).
;   3. Press F7 again - everything collected is on the clipboard.
;
;  F8 - border screenshot scan
;   1. In PoE, HOLD Alt yourself so all 12 border tooltips are shown.
;   2. Press F8. A beep tells you the screenshot is taken - let go.
;   3. Windows OCR reads the 12 tooltips locally (nothing is uploaded,
;      nothing leaves your PC) and the result lands on the clipboard -
;      or joins the F7 batch if copy mode is on.
;
;  Then ONE Ctrl+V on the solver page imports charts + borders.
;  English and Korean clients are both supported.
;
;  Shift+F7 mutes/unmutes the beeps (the on-screen counter still works).
;
;  If PoE runs as administrator, run this script as administrator too,
;  or its hotkeys won't register while the game window is focused.
; =====================================================================

CollectorVersion := "2026-08-20"
PoeWinTitle := "Path of Exile"

Collecting := false
Collected := []
LastCaptured := ""
BorderBlob := ""
BorderCount := 0
Muted := false

; every sound goes through here so Shift+F7 can silence the lot
Beep(freq, dur) {
    global Muted
    if !Muted
        SoundBeep freq, dur
}

ToggleMute(*) {
    global Muted
    Muted := !Muted
    ToolTip Muted ? "🔇 Beeps muted - Shift+F7 to unmute (the on-screen counter still works)"
        : "🔊 Beeps back on"
    SetTimer () => ToolTip(), -2500
}

; %TEMP% can arrive as an 8.3 short path (C:\Users\HARDPC~1\...) and WinRT
; (which Windows OCR uses to open images) can refuse those - expand it first.
LongPath(path) {
    buf := Buffer(1040, 0)
    len := DllCall("GetLongPathNameW", "Str", path, "Ptr", buf.Ptr, "UInt", 520, "UInt")
    return (len > 0 && len <= 520) ? StrGet(buf, "UTF-16") : path
}
TempDir := LongPath(A_Temp)
ScriptPid := ProcessExist()
HelperPs1 := TempDir "\voyage-border-read-" ScriptPid ".ps1"
HelperOut := TempDir "\voyage-border-read-" ScriptPid ".txt"
HelperShot := TempDir "\voyage-border-read-" ScriptPid ".shot"
HelperPng := TempDir "\voyage-border-read-" ScriptPid ".png"
HelperPid := 0

CleanupHelper(*) {
    global HelperPid, HelperPs1, HelperOut, HelperShot, HelperPng
    if (HelperPid && ProcessExist(HelperPid))
        try ProcessClose HelperPid  ; our own PowerShell child, never the game
    for , f in [HelperPs1, HelperOut, HelperOut ".tmp", HelperShot, HelperPng, HelperPng ".prep.png"]
        try FileDelete f
}
OnExit CleanupHelper

; a chart's item text starts with its class header (English or Korean)
IsChartText(text) {
    return RegExMatch(text, "im)^\s*(Item Class\s*[:：]\s*Charts?|아이템 종류\s*[:：]\s*해도)")
}

ShowCounter() {
    global Collecting, Collected, BorderCount
    if Collecting
        ToolTip "📋 Copy mode: " Collected.Length " chart" (Collected.Length = 1 ? "" : "s")
            . (BorderCount ? "  +  " BorderCount "/12 borders ✓" : "")
            . " collected`nCtrl+C charts / F8 for borders - F7 to finish",
            A_ScreenWidth // 2 - 160, 40
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
    Beep(880, 60)
    ShowCounter()
}
OnClipboardChange OnClipChanged

ToggleCollect(*) {
    global Collecting, Collected, LastCaptured, BorderBlob, BorderCount
    if !Collecting {
        Collecting := true
        Collected := []
        LastCaptured := ""
        ShowCounter()
        return
    }
    Collecting := false
    if (Collected.Length = 0 && BorderBlob = "") {
        ToolTip "Copy mode off - nothing collected."
        SetTimer () => ToolTip(), -2500
        return
    }
    combined := ""
    for , chart in Collected
        combined .= (combined = "" ? "" : "`n`n") chart
    if (BorderBlob != "")
        combined .= (combined = "" ? "" : "`n") BorderBlob
    A_Clipboard := combined
    note := "✅ " Collected.Length " chart" (Collected.Length = 1 ? "" : "s")
    if (BorderCount)
        note .= " + " BorderCount "/12 borders"
    ToolTip note " on the clipboard - Ctrl+V on the solver page to import everything.",
        A_ScreenWidth // 2 - 180, 40
    SetTimer () => ToolTip(), -6000
    Beep(1200, 90)
    BorderBlob := ""
    BorderCount := 0
}

; Korean PoE client ships as *_KG.exe - prefer the Korean OCR pack for it.
; (Reading the window's process name is a passive query, not an input.)
PreferredOcrLanguage() {
    global PoeWinTitle
    try {
        processName := WinGetProcessName(PoeWinTitle)
        if RegExMatch(processName, "i)_KG\.exe$")
            return "ko-KR"
    }
    return ""
}

; The 12 border-tooltip anchor points scale with the game window's height
; around its centre. Measured from field calibrations at 2560x1440 and
; 1920x1200 (they agree within ~2% of height, and neighbouring anchors sit
; ~13% apart, so the assignment has huge margin). Order: top L>R,
; right T>B, bottom L>R, left T>B - the solver's border slot order.
AnchorFractions := [
    [-0.166, -0.233], [-0.025, -0.232], [0.134, -0.231],
    [0.212, -0.137], [0.211, -0.004], [0.219, 0.152],
    [-0.177, 0.241], [-0.022, 0.241], [0.140, 0.243],
    [-0.253, -0.137], [-0.255, -0.001], [-0.244, 0.137],
]

RunBorderScan(testImage := "", testW := 0, testH := 0) {
    global
    if (HelperPid && ProcessExist(HelperPid)) {
        ToolTip "A border scan is already running - one moment..."
        SetTimer () => ToolTip(), -2000
        return
    }
    winX := 0, winY := 0
    winW := testW ? testW : A_ScreenWidth
    winH := testH ? testH : A_ScreenHeight
    if (testImage = "") {
        if WinExist(PoeWinTitle)
            WinGetPos &winX, &winY, &winW, &winH, PoeWinTitle  ; passive read
        ToolTip "📸 Keep holding Alt so all 12 border tooltips stay visible...",
            A_ScreenWidth // 2 - 160, 40
    }
    points := ""
    cx := winW / 2.0
    cy := winH / 2.0
    for , f in AnchorFractions
        points .= (points = "" ? "" : ";") Round(cx + f[1] * winH) "," Round(cy + f[2] * winH)
    try FileDelete HelperOut
    try FileDelete HelperShot
    try FileDelete HelperPs1
    FileAppend BorderHelperPs(), HelperPs1, "UTF-8"
    quote := Chr(34)
    command := "powershell.exe -NoProfile -ExecutionPolicy Bypass -File " quote HelperPs1 quote
        . " -Left " winX " -Top " winY " -Width " winW " -Height " winH
        . " -PointSpec " quote points quote
        . " -PreferredLanguage " quote PreferredOcrLanguage() quote
        . " -WorkPng " quote HelperPng quote
        . " -ShotMarker " quote HelperShot quote
        . " -OutputPath " quote HelperOut quote
        . (testImage != "" ? " -ImagePath " quote testImage quote : "")
    Run command, , "Hide", &HelperPid
    ; beep the moment the screenshot is on disk so Alt can be released early -
    ; the OCR itself takes a few more seconds
    deadline := A_TickCount + 20000
    while (!FileExist(HelperShot) && ProcessExist(HelperPid) && A_TickCount < deadline)
        Sleep 50
    if FileExist(HelperShot) {
        Beep(700, 90)
        ToolTip "Screenshot taken - you can let go of Alt.`nReading the 12 borders with Windows OCR (all local, nothing uploaded)...",
            A_ScreenWidth // 2 - 180, 40
    }
    deadline := A_TickCount + 120000
    while (!FileExist(HelperOut) && ProcessExist(HelperPid) && A_TickCount < deadline)
        Sleep 100
    Sleep 100
    blob := ""
    try blob := Trim(FileRead(HelperOut, "UTF-8"), " `t`r`n")
    HelperPid := 0
    if (blob = "" || InStr(blob, "HELPER ERROR")) {
        ToolTip "Border scan failed - you can still enter borders by clicking the board slots.`n"
            . SubStr(blob = "" ? "(no result - timed out?)" : blob, 1, 220)
        SetTimer () => ToolTip(), -7000
        Beep(300, 150)
        return
    }
    total := 0
    p := 1
    while (p := InStr(blob, "=== VOYAGE BORDER", true, p)) {
        total++
        p += 17
    }
    errors := 0
    p := 1
    while (p := InStr(blob, "OCR ERROR", true, p)) {
        errors++
        p += 9
    }
    good := total - errors
    BorderBlob := blob
    BorderCount := good
    if Collecting {
        Beep(1000, 90)
        ShowCounter()
    } else {
        A_Clipboard := blob
        Beep(1200, 90)
        ToolTip "✅ Read " good "/12 borders - Ctrl+V on the solver page to import them."
            . (good < 12 ? "`nMissed ones can be picked by clicking their board slot." : ""),
            A_ScreenWidth // 2 - 180, 40
        SetTimer () => ToolTip(), -6000
    }
}

F7:: ToggleCollect()
; * = fire even while modifiers are held: the whole point of F8 is pressing
; it WHILE Alt is held for the tooltips, and a bare F8 hotkey never fires
; with a modifier down (issue #48: no beep, and the keypress fell through
; to the game, where F8 is PoE's own screenshot bind - hence the mystery
; "screenshot saved" notifications)
*F8:: RunBorderScan()
+F7:: ToggleMute()

A_TrayMenu.Insert("1&", "Toggle copy mode (F7)", ToggleCollect)
A_TrayMenu.Insert("2&", "Scan borders now (F8)", RunBorderScan)
A_TrayMenu.Insert("3&", "Mute beeps (Shift+F7)", ToggleMute)
A_TrayMenu.Default := "Toggle copy mode (F7)"
A_IconTip := "Voyage collector - F7 charts, F8 borders"
TrayTip "Voyage collector ready", "F7 = chart copy mode, F8 = border screenshot scan. This tool never sends any input to the game.", 1

; ---------------------------------------------------------------------
; The border-reading PowerShell helper. Runs Windows OCR locally on a
; screenshot taken while the PLAYER holds Alt. Zero backticks allowed -
; AutoHotkey would strip them when writing the file.
; ---------------------------------------------------------------------
BorderHelperPs() {
    return "
(
param(
    [int]$Left = 0,
    [int]$Top = 0,
    [int]$Width = 0,
    [int]$Height = 0,
    [string]$PointSpec = '',
    [string]$ImagePath = '',
    [string]$PreferredLanguage = '',
    [Parameter(Mandatory = $true)][string]$WorkPng,
    [Parameter(Mandatory = $true)][string]$ShotMarker,
    [Parameter(Mandatory = $true)][string]$OutputPath)

$ErrorActionPreference = 'Stop'
trap {
    $utf8 = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText(
        $OutputPath,
        ('HELPER ERROR: ' + $_.Exception.ToString()),
        $utf8)
    exit 1
}
Add-Type -AssemblyName System.Drawing

# ---- capture FIRST, before anything slow compiles: the player is holding
# ---- Alt and waiting for the "you can let go" beep
if ($ImagePath -ne '') {
    Copy-Item -LiteralPath $ImagePath -Destination $WorkPng -Force
} else {
    if ($Width -le 0 -or $Height -le 0) { throw 'Invalid window size.' }
    $image = [System.Drawing.Bitmap]::new($Width, $Height)
    $graphics = [System.Drawing.Graphics]::FromImage($image)
    try {
        $graphics.CopyFromScreen($Left, $Top, 0, 0, $image.Size)
        $image.Save($WorkPng, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $graphics.Dispose()
        $image.Dispose()
    }
}
[System.IO.File]::WriteAllText($ShotMarker, 'SHOT')

Add-Type -AssemblyName System.Runtime.WindowsRuntime

Add-Type -ReferencedAssemblies 'System.Drawing' -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class VoyageOcrImage
{
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern uint GetLongPathNameW(string shortPath, System.Text.StringBuilder buffer, uint bufferLength);

    // %TEMP% can arrive as an 8.3 short path (C:\Users\HARDPC~1\...). Win32
    // tolerates those, but WinRT StorageFile - which Windows OCR uses to open
    // images - can refuse them ('An object at the specified path does not
    // exist'), failing the scan on every image it just wrote (issues #27/#35).
    public static string LongPath(string path)
    {
        try
        {
            System.Text.StringBuilder buffer = new System.Text.StringBuilder(1024);
            uint length = GetLongPathNameW(path, buffer, 1024);
            if (length > 0 && length < 1024) { return buffer.ToString(); }
        }
        catch { }
        return path;
    }

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

    // HDR desktops make GDI captures washed-out and low-contrast (issue #33):
    // colours shift enough to defeat the lavender mask, and the raw image is
    // too flat for OCR. Stretch the 2nd..98th percentile luminance range to
    // full contrast as a last-chance pass; same scale/padding as Prepare so
    // word geometry maps back identically.
    public static void Normalize(string sourcePath, string outputPath)
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

            var histogram = new int[256];
            var lums = new byte[source.Width * source.Height];
            var index = 0;
            for (var y = 0; y < source.Height; y++)
            {
                for (var x = 0; x < source.Width; x++)
                {
                    var offset = y * sourceStride + x * 4;
                    var lum = (byte)((sourceBytes[offset] * 114 +
                        sourceBytes[offset + 1] * 587 +
                        sourceBytes[offset + 2] * 299) / 1000);
                    lums[index++] = lum;
                    histogram[lum]++;
                }
            }
            var total = source.Width * source.Height;
            var lowTarget = total / 50;
            var highTarget = total - total / 50;
            var low = 0;
            var high = 255;
            var cumulative = 0;
            for (var i = 0; i < 256; i++)
            {
                cumulative += histogram[i];
                if (cumulative <= lowTarget) { low = i; }
                if (cumulative < highTarget) { high = i; }
            }
            if (high <= low) { high = low + 1; }

            using (var mask = new Bitmap(source.Width, source.Height, PixelFormat.Format24bppRgb))
            {
                var maskData = mask.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format24bppRgb);
                var maskStride = Math.Abs(maskData.Stride);
                var maskBytes = new byte[maskStride * mask.Height];
                index = 0;
                for (var y = 0; y < source.Height; y++)
                {
                    for (var x = 0; x < source.Width; x++)
                    {
                        var stretched = (lums[index++] - low) * 255 / (high - low);
                        if (stretched < 0) { stretched = 0; }
                        if (stretched > 255) { stretched = 255; }
                        var value = (byte)stretched;
                        var maskOffset = y * maskStride + x * 3;
                        maskBytes[maskOffset] = value;
                        maskBytes[maskOffset + 1] = value;
                        maskBytes[maskOffset + 2] = value;
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
    param([string]$PreferredLanguage = '')

    $available = @([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages)

    # Localized PoE clients need a matching OCR engine. Windows can expose the
    # Korean pack as either "ko" or a regional tag such as "ko-KR", so match
    # both the exact tag and its primary language before considering fallback.
    if (-not [string]::IsNullOrWhiteSpace($PreferredLanguage)) {
        $preferredTag = $PreferredLanguage.Trim()
        $preferredPrimary = ($preferredTag -split '-', 2)[0]
        $preferred = @($available | Where-Object {
            $tag = $_.LanguageTag
            $primary = ($tag -split '-', 2)[0]
            $tag -ieq $preferredTag -or $primary -ieq $preferredPrimary
        } | Sort-Object {
            if ($_.LanguageTag -ieq $preferredTag) { 0 }
            elseif ($_.LanguageTag -ieq $preferredPrimary) { 1 }
            else { 2 }
        })

        foreach ($language in $preferred) {
            $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
            if ($null -ne $engine) {
                return $engine
            }
        }

        throw ("Windows OCR language '$preferredTag' is not installed. " +
            'Install the matching Windows language OCR feature. For Korean, open an elevated ' +
            'Command Prompt and run: DISM /Online /Add-Capability ' +
            '/CapabilityName:Language.OCR~~~ko-KR~0.0.1.0')
    }

    # English clients keep the original English-first behavior. Do not require
    # en-US specifically: many Windows installs only have en-GB or another
    # Latin-script OCR language.
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

function Add-Block {
    param(
        [Parameter(Mandatory = $true)][System.Text.StringBuilder]$Builder,
        [Parameter(Mandatory = $true)][int]$Index,
        [Parameter(Mandatory = $true)][string]$Text)
    [void]$Builder.AppendLine("=== VOYAGE BORDER $Index ===")
    [void]$Builder.AppendLine($Text)
    [void]$Builder.AppendLine('=== END VOYAGE BORDER ===')
}

function Get-OcrLineRects {
    param([string]$Path, $Engine, [double]$Scale, [double]$Pad)
    $file = Await-Result ([Windows.Storage.StorageFile]::GetFileFromPathAsync($Path)) ([Windows.Storage.StorageFile])
    $stream = Await-Result ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    try {
        $decoder = Await-Result ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $bitmap = Await-Result ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        try {
            $result = Await-Result ($Engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
            $found = @()
            foreach ($line in $result.Lines) {
                $minX = [double]::MaxValue
                $minY = [double]::MaxValue
                $maxX = 0.0
                $maxY = 0.0
                foreach ($word in $line.Words) {
                    $r = $word.BoundingRect
                    if ($r.X -lt $minX) { $minX = $r.X }
                    if ($r.Y -lt $minY) { $minY = $r.Y }
                    if (($r.X + $r.Width) -gt $maxX) { $maxX = $r.X + $r.Width }
                    if (($r.Y + $r.Height) -gt $maxY) { $maxY = $r.Y + $r.Height }
                }
                if ($minX -eq [double]::MaxValue) { continue }
                $found += [pscustomobject]@{
                    Text = $line.Text
                    X = ($minX - $Pad) / $Scale
                    Y = ($minY - $Pad) / $Scale
                    R = ($maxX - $Pad) / $Scale
                    B = ($maxY - $Pad) / $Scale
                }
            }
            return $found
        } finally {
            if ($null -ne $bitmap) { $bitmap.Dispose() }
        }
    } finally {
        $stream.Dispose()
    }
}

function Resolve-BorderAssignment {
    param($Points, $Blocks)
    $count = $Points.Count
    $dist = New-Object 'double[,]' $count, $Blocks.Count
    for ($p = 0; $p -lt $count; $p++) {
        for ($b = 0; $b -lt $Blocks.Count; $b++) {
            $cx = ($Blocks[$b].X + $Blocks[$b].R) / 2.0
            $cy = ($Blocks[$b].Y + $Blocks[$b].B) / 2.0
            $dx = $cx - $Points[$p].X
            $dy = $cy - $Points[$p].Y
            $dist[$p, $b] = $dx * $dx + $dy * $dy
        }
    }
    $assigned = @($null) * $count
    $used = @{}
    $order = @()
    for ($p = 0; $p -lt $count; $p++) {
        for ($b = 0; $b -lt $Blocks.Count; $b++) {
            $order += [pscustomobject]@{ P = $p; B = $b; D = $dist[$p, $b] }
        }
    }
    foreach ($pair in ($order | Sort-Object D)) {
        if ($null -ne $assigned[$pair.P] -or $used.ContainsKey($pair.B)) { continue }
        $assigned[$pair.P] = $pair.B
        $used[$pair.B] = $true
    }
    $improved = $true
    $rounds = 0
    while ($improved -and $rounds -lt 50) {
        $improved = $false
        $rounds++
        for ($i = 0; $i -lt $count; $i++) {
            for ($j = $i + 1; $j -lt $count; $j++) {
                $bi = $assigned[$i]
                $bj = $assigned[$j]
                if ($null -eq $bi -or $null -eq $bj) { continue }
                if (($dist[$i, $bj] + $dist[$j, $bi]) -lt ($dist[$i, $bi] + $dist[$j, $bj])) {
                    $assigned[$i] = $bj
                    $assigned[$j] = $bi
                    $improved = $true
                }
            }
        }
    }
    return $assigned
}

$prepared = $WorkPng + '.prep.png'
$builder = [System.Text.StringBuilder]::new()
try {
    $engine = New-OcrEngine -PreferredLanguage $PreferredLanguage
    # mirror the transform inside VoyageOcrImage::Prepare so rects map back
    $scale = [Math]::Min(2.0, 6000.0 / [Math]::Max($Width, $Height))
    [VoyageOcrImage]::Prepare($WorkPng, $prepared)
    $lines = @(Get-OcrLineRects $prepared $engine $scale 64.0)
    if ($lines.Count -eq 0) { $lines = @(Get-OcrLineRects $WorkPng $engine 1.0 0.0) }
    # HDR-washout rescue: contrast-stretch and retry
    if ($lines.Count -eq 0) {
        [VoyageOcrImage]::Normalize($WorkPng, $prepared)
        $lines = @(Get-OcrLineRects $prepared $engine $scale 64.0)
    }
    if ($lines.Count -eq 0) { throw 'Windows OCR found no border tooltips. Were all 12 visible (Alt held) when the beep came?' }
    # cluster vertically-adjacent, horizontally-overlapping lines
    $blocks = @()
    foreach ($line in ($lines | Sort-Object Y)) {
        $joined = $false
        foreach ($block in $blocks) {
            $lineHeight = [Math]::Max(12.0, $line.B - $line.Y)
            $xOverlap = [Math]::Min($line.R, $block.R) - [Math]::Max($line.X, $block.X)
            if (($line.Y - $block.B) -le ($lineHeight * 0.9) -and $xOverlap -gt 0) {
                $block.Text = $block.Text + [Environment]::NewLine + $line.Text
                if ($line.X -lt $block.X) { $block.X = $line.X }
                if ($line.R -gt $block.R) { $block.R = $line.R }
                if ($line.B -gt $block.B) { $block.B = $line.B }
                $joined = $true
                break
            }
        }
        if (-not $joined) {
            $blocks += [pscustomobject]@{ Text = $line.Text; X = $line.X; Y = $line.Y; R = $line.R; B = $line.B }
        }
    }
    # Ground-loot labels are blue, blue passes the tooltip mask, and a
    # 13th text block then displaces a real tooltip in the 12-slot
    # assignment (issue #41: "HYDRASCALE BOOTS" stole a border). Every
    # real border tooltip mentions adjacency in English or Korean, so
    # gate the clusters on that. A tooltip mangled beyond recognition
    # gets dropped here too, which just means a hover rescan - never a
    # loot label imported as a border.
    $blocks = @($blocks | Where-Object { $_.Text -match 'adjacent|areas|voyage|인접|지역|항해' })
    $points = @()
    foreach ($pair in $PointSpec.Split(';')) {
        $xy = $pair.Split(',')
        $points += [pscustomobject]@{ X = [double]$xy[0]; Y = [double]$xy[1] }
    }
    $assigned = Resolve-BorderAssignment $points $blocks
    for ($p = 0; $p -lt $points.Count; $p++) {
        if ($null -ne $assigned[$p]) {
            Add-Block $builder $p $blocks[$assigned[$p]].Text
        } else {
            Add-Block $builder $p 'OCR ERROR: no tooltip found near this border.'
        }
    }
} catch {
    $builder = [System.Text.StringBuilder]::new()
    for ($p = 0; $p -lt 12; $p++) {
        Add-Block $builder $p ('OCR ERROR: ' + $_.Exception.Message)
    }
} finally {
    Remove-Item -LiteralPath $WorkPng -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $prepared -Force -ErrorAction SilentlyContinue
}
$utf8Out = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText(($OutputPath + '.tmp'), $builder.ToString(), $utf8Out)
Move-Item -LiteralPath ($OutputPath + '.tmp') -Destination $OutputPath -Force
)"
}

