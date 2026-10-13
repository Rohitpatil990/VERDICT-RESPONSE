Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Close any existing browsers on port 3000 windows
Get-Process chrome, msedge -ErrorAction SilentlyContinue | Stop-Process -Force

Start-Sleep -Seconds 2

# Open Chrome with the scale-test URL
$chromePath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $chromePath)) {
    $chromePath = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
}

if (Test-Path $chromePath) {
    & $chromePath "http://localhost:3000/scale-test" --new-window
} else {
    # Fallback to Edge or default browser
    Start-Process 'http://localhost:3000/scale-test'
}

# Wait for the page to fully load and render
Start-Sleep -Seconds 10

# Get primary screen bounds
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds

# Create bitmap and graphics object
$bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

# Capture screen
$graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)

# Save screenshot
$outputPath = 'C:\Users\Rohit Patil\OneDrive\Documents\Final_PrintWinners\artifacts\scale-test\VERDICT_500_REGION_SCALE_TEST.png'
$bitmap.Save($outputPath)

# Clean up
$bitmap.Dispose()
$graphics.Dispose()

Write-Host "Screenshot saved to: $outputPath"
Write-Host "File size: $((Get-Item $outputPath).Length) bytes"
