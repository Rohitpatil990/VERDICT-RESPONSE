# Open VERDICT Dashboard from Docker container
$chromePath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $chromePath)) {
    $chromePath = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
}

if (Test-Path $chromePath) {
    # Open dashboard overview page
    & $chromePath "http://localhost:3000" --new-window --start-maximized --disable-extensions --disable-plugins
    Write-Host "Opening VERDICT Dashboard..."
    Write-Host "Dashboard URL: http://localhost:3000"
    Write-Host "Scale Test Page: http://localhost:3000/scale-test"
} else {
    Start-Process 'http://localhost:3000'
    Write-Host "Opening dashboard in default browser..."
}

# Keep window open
Start-Sleep -Seconds 2
Write-Host "Dashboard opened successfully"
Write-Host "All 3 regions running in Docker:"
Write-Host "  - Mumbai: http://localhost:4001/api/v1/status"
Write-Host "  - Delhi: http://localhost:4002/api/v1/status"
Write-Host "  - Bengaluru: http://localhost:4003/api/v1/status"
