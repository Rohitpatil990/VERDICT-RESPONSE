Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Wait for browser to render
Start-Sleep -Seconds 3

# Get screen
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds

# Capture
$bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)

# Save
$outputPath = 'C:\Users\Rohit Patil\OneDrive\Documents\Final_PrintWinners\VERDICT_Dashboard_Running.png'
$bitmap.Save($outputPath)

$bitmap.Dispose()
$graphics.Dispose()

Write-Host "Screenshot saved: $outputPath"
Write-Host "File size: $(Get-Item $outputPath | Select-Object -ExpandProperty Length) bytes"
