# Bulk Upload PDFs to Database
# Run with: powershell -ExecutionPolicy Bypass -File scripts\bulkUploadPdfs.ps1

$apiUrl = "http://localhost:4001/api/pdf/documents"
$apiKey = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"

$headers = @{
    "Content-Type" = "application/json"
    "X-API-Key" = $apiKey
}

# Array of PDFs to upload
$pdfs = @(
    @{
        title = "Available Arbitrary Opportunities"
        description = "Investment opportunities available for arbitrage"
        filePath = "public/pdfs/available -Arbitrary-Opportunities.pdf"
        fileUrl = "/pdfs/available -Arbitrary-Opportunities.pdf"
        displayOrder = 1
        category = "Investment"
    },
    @{
        title = "Investment Prospectus"
        description = "Official investment prospectus document"
        filePath = "public/pdfs/prospectus.pdf"
        fileUrl = "/pdfs/prospectus.pdf"
        displayOrder = 2
        category = "General"
    },
    @{
        title = "Terms & Conditions"
        description = "Legal terms and conditions"
        filePath = "public/pdfs/terms-and-conditions.pdf"
        fileUrl = "/pdfs/terms-and-conditions.pdf"
        displayOrder = 3
        category = "Legal"
    },
    @{
        title = "Annual Report 2024"
        description = "Annual financial report"
        filePath = "public/pdfs/annual-report-2024.pdf"
        fileUrl = "/pdfs/annual-report-2024.pdf"
        displayOrder = 4
        category = "Financial"
    }
)

Write-Host "🚀 Starting bulk PDF upload..." -ForegroundColor Cyan
Write-Host "Total PDFs to upload: $($pdfs.Count)" -ForegroundColor Yellow
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($pdf in $pdfs) {
    Write-Host "📄 Uploading: $($pdf.title)" -ForegroundColor White

    $body = $pdf | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri $apiUrl -Method Post -Headers $headers -Body $body

        if ($response.success) {
            Write-Host "   ✅ Success: $($pdf.title)" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "   ❌ Failed: $($response.message)" -ForegroundColor Red
            $failCount++
        }
    } catch {
        Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        $failCount++
    }

    Write-Host ""
}

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "✅ Upload complete!" -ForegroundColor Green
Write-Host "   Success: $successCount" -ForegroundColor Green
Write-Host "   Failed: $failCount" -ForegroundColor Red
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
