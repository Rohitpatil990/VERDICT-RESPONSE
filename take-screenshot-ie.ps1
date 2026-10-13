Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Net.Http

# Wait for any previous browser to load
Start-Sleep -Seconds 2

# Use Internet Explorer/Edge to navigate and wait
$ie = New-Object -ComObject InternetExplorer.Application
$ie.Navigate("http://localhost:3000/scale-test")
$ie.Visible = $true

# Wait for page load
$maxWait = 15
$waited = 0
while ($ie.Busy -and $waited -lt $maxWait) {
    Start-Sleep -Milliseconds 500
    $waited++
}
Start-Sleep -Seconds 3

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
$ie.Quit()

Write-Host "Screenshot saved to: $outputPath"
