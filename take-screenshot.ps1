Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Open browser to scale-test page
Start-Process 'http://localhost:3000/scale-test'

# Wait for page to fully load and render
Start-Sleep -Seconds 8

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
