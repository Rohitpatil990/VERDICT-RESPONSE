Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Kill existing Chrome
Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Open Chrome with direct navigation to scale-test
$chromePath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $chromePath)) {
    $chromePath = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
}

if (Test-Path $chromePath) {
    # Open in maximized window
    $processArgs = @(
        'http://localhost:3000/?tab=scale-test',
        '--new-window',
        '--start-maximized',
        '--disable-background-networking',
        '--disable-backgrounding-occluded-windows'
    )
    & $chromePath $processArgs[0] $processArgs[1] $processArgs[2] $processArgs[3] $processArgs[4]
} else {
    Start-Process 'http://localhost:3000/?tab=scale-test'
}

# Wait significantly longer for React to render the component
Write-Host "Waiting for page to render..."
Start-Sleep -Seconds 12

# Bring Chrome to foreground
Add-Type -MemberDefinition @"
[DllImport("user32.dll")]
public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
[DllImport("user32.dll")]
public static extern bool SetForegroundWindow(IntPtr hWnd);
"@ -Name Win32 -Namespace Win32Functions

$chromeWindow = Get-Process chrome -ErrorAction SilentlyContinue | Select-Object -First 1
if ($chromeWindow) {
    $handle = [Win32Functions.Win32]::FindWindow([System.Runtime.InteropServices.Marshal]::StringToHGlobalAnsi("Chrome_WidgetWin_1"), [System.IntPtr]::Zero)
    if ($handle -ne [IntPtr]::Zero) {
        [Win32Functions.Win32]::SetForegroundWindow($handle) | Out-Null
    }
}

# Wait a bit more for rendering
Start-Sleep -Seconds 3

# Capture full screen
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)

# Save screenshot
$outputPath = 'C:\Users\Rohit Patil\OneDrive\Documents\Final_PrintWinners\artifacts\scale-test\VERDICT_500_REGION_SCALE_TEST.png'
$bitmap.Save($outputPath)

$bitmap.Dispose()
$graphics.Dispose()

$fileSize = (Get-Item $outputPath).Length
Write-Host "Screenshot saved: $outputPath ($fileSize bytes)"
