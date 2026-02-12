#!/bin/bash

# Fix PDF URLs via API
# Replace YOUR_API_KEY with your actual admin API key

API_KEY="YOUR_API_KEY_HERE"

# Update first PDF document
curl -X PUT http://localhost:4001/api/pdf/documents/698d107c50b2aa53fbc65cc0 \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "fileUrl": "/pdfs/available-arbitrary-opportunities.pdf",
    "filePath": "/pdfs/available-arbitrary-opportunities.pdf"
  }'

echo ""
echo "---"
echo ""

# Update second PDF document
curl -X PUT http://localhost:4001/api/pdf/documents/698d13075b695aa64b92c963 \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "fileUrl": "/pdfs/available-arbitrary-opportunities.pdf",
    "filePath": "/pdfs/available-arbitrary-opportunities.pdf"
  }'

echo ""
echo "---"
echo "Done! Now check: curl http://localhost:4001/api/pdf/documents"
