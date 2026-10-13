Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$chromePath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $chromePath)) {
    $chromePath = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
}

# Start Chrome directly pointing to scale-test with user data directory to avoid extensions
$userDataDir = $env:TEMP + '\chrome-tmp-' + (Get-Random)
New-Item -ItemType Directory -Path $userDataDir -Force | Out-Null

$processArgs = @(
    "http://localhost:3000/scale-test",
    "--user-data-dir=$userDataDir",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-plugins",
    "--start-maximized"
)

& $chromePath @processArgs

Write-Host "Chrome starting..."
Start-Sleep -Seconds 15

# Take screenshot
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)

$outputPath = 'C:\Users\Rohit Patil\OneDrive\Documents\Final_PrintWinners\artifacts\scale-test\VERDICT_500_REGION_SCALE_TEST.png'
$bitmap.Save($outputPath)

$bitmap.Dispose()
$graphics.Dispose()

Write-Host "Screenshot saved to: $outputPath"

# Clean up temp directory
Remove-Item $userDataDir -Recurse -Force -ErrorAction SilentlyContinue
