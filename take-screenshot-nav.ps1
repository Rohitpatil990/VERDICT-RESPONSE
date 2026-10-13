Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Open Chrome with scale-test URL
$chromePath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $chromePath)) {
    $chromePath = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
}

# Kill any existing Chrome windows
Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

# Open browser to main page first
if (Test-Path $chromePath) {
    & $chromePath "http://localhost:3000" --new-window --start-maximized
} else {
    Start-Process 'http://localhost:3000' 
}

# Wait for initial load
Start-Sleep -Seconds 8

# Use keyboard automation to navigate to Scale Test
# Alt+Tab to Chrome window, then use keyboard navigation
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('%{TAB}')
Start-Sleep -Milliseconds 500

# Press 'S' key to click Scale Test menu (keyboard shortcut), or use Tab navigation
# Try pressing Tab multiple times to navigate to Scale Test link
for ($i = 0; $i -lt 8; $i++) {
    [System.Windows.Forms.SendKeys]::SendWait('{TAB}')
    Start-Sleep -Milliseconds 200
}

# Press Enter to activate Scale Test
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')

# Wait for Scale Test page to load
Start-Sleep -Seconds 6

# Get screen bounds
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds

# Create bitmap and capture
$bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)

# Save
$outputPath = 'C:\Users\Rohit Patil\OneDrive\Documents\Final_PrintWinners\artifacts\scale-test\VERDICT_500_REGION_SCALE_TEST.png'
$bitmap.Save($outputPath)

$bitmap.Dispose()
$graphics.Dispose()

Write-Host "Screenshot saved to: $outputPath ($(Get-Item $outputPath | Select-Object -ExpandProperty Length) bytes)"
