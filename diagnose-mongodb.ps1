Write-Host "MongoDB Atlas Configuration Check" -ForegroundColor Green
Write-Host "=================================="  -ForegroundColor Green
Write-Host ""

$envPath = "backend\.env"

if (Test-Path $envPath) {
    $content = Get-Content $envPath | Select-String "MONGODB_URI"
    Write-Host "OK - .env file found" -ForegroundColor Green
    Write-Host $content -ForegroundColor Cyan
    Write-Host ""
    Write-Host "NEXT STEPS:" -ForegroundColor Yellow
    Write-Host "1. Go to MongoDB Atlas: https://cloud.mongodb.com/"
    Write-Host "2. Click 'Cluster0', then 'Database Access'"
    Write-Host "3. Verify user 'Tushar' exists and password is 'Tushar'"
    Write-Host "4. Click 'Cluster0', then 'Network Access'"
    Write-Host "5. Verify '0.0.0.0/0' is whitelisted (or add it)"
    Write-Host "6. Restart server: npm start"
    Write-Host ""
} else {
    Write-Host "ERROR - .env file not found at $envPath" -ForegroundColor Red
}
