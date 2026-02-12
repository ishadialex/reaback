# Complete Guide: Upload PDFs to Database

This guide shows you how to add PDF documents to your application in 2 simple steps.

---

## 📋 Quick Steps

### Step 1: Add Physical PDF File
Copy your PDF to: `public/pdfs/your-document.pdf`

### Step 2: Add Database Record
Use any method below to create a database entry

---

## 🔧 Step 1: Add Physical PDF File

### Option A: Using File Explorer (Easiest)

1. **Navigate to:**
   ```
   c:\Users\dfxMafia\Documents\startup-nextjs-main1\alvarado-backend\public\pdfs\
   ```

2. **Copy your PDF file** into this folder

3. **Rename following naming conventions:**
   - ✅ Good: `investment-prospectus.pdf`
   - ✅ Good: `terms-and-conditions.pdf`
   - ✅ Good: `annual-report-2024.pdf`
   - ❌ Bad: `Investment Prospectus.pdf` (spaces)
   - ❌ Bad: `terms&conditions.pdf` (special characters)

### Option B: Using Command Line

**Windows Command Prompt:**
```cmd
copy "C:\Downloads\prospectus.pdf" "c:\Users\dfxMafia\Documents\startup-nextjs-main1\alvarado-backend\public\pdfs\prospectus.pdf"
```

**PowerShell:**
```powershell
Copy-Item "C:\Downloads\prospectus.pdf" "c:\Users\dfxMafia\Documents\startup-nextjs-main1\alvarado-backend\public\pdfs\prospectus.pdf"
```

---

## 🗄️ Step 2: Add Database Record

### Method 1: Using Postman (Recommended for Beginners)

**1. Setup Request:**
- Method: `POST`
- URL: `http://localhost:4001/api/pdf/documents`

**2. Add Headers:**
```
Content-Type: application/json
X-API-Key: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
```

**3. Add Body (raw JSON):**
```json
{
  "title": "Investment Prospectus",
  "description": "Official investment prospectus document",
  "filePath": "public/pdfs/prospectus.pdf",
  "fileUrl": "/pdfs/prospectus.pdf",
  "displayOrder": 1,
  "category": "General"
}
```

**4. Click Send**

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "title": "Investment Prospectus",
    "fileUrl": "/pdfs/prospectus.pdf",
    ...
  },
  "message": "PDF document created successfully"
}
```

---

### Method 2: Using cURL

**Windows Command Prompt:**
```cmd
curl -X POST http://localhost:4001/api/pdf/documents ^
  -H "Content-Type: application/json" ^
  -H "X-API-Key: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2" ^
  -d "{\"title\":\"Investment Prospectus\",\"description\":\"Official prospectus\",\"filePath\":\"public/pdfs/prospectus.pdf\",\"fileUrl\":\"/pdfs/prospectus.pdf\",\"displayOrder\":1,\"category\":\"General\"}"
```

**PowerShell:**
```powershell
$headers = @{
    "Content-Type" = "application/json"
    "X-API-Key" = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
}

$body = @{
    title = "Investment Prospectus"
    description = "Official prospectus"
    filePath = "public/pdfs/prospectus.pdf"
    fileUrl = "/pdfs/prospectus.pdf"
    displayOrder = 1
    category = "General"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:4001/api/pdf/documents" -Method Post -Headers $headers -Body $body
```

---

### Method 3: Using MongoDB Compass

**1. Open MongoDB Compass**

**2. Connect to database** using connection string from `.env`:
```
mongodb+srv://...
```

**3. Navigate to:**
- Database: `alvarado`
- Collection: `pdfDocuments`

**4. Click "ADD DATA" → "Insert Document"**

**5. Paste JSON:**
```json
{
  "title": "Investment Prospectus",
  "description": "Official investment prospectus document",
  "filePath": "public/pdfs/prospectus.pdf",
  "fileUrl": "/pdfs/prospectus.pdf",
  "displayOrder": 1,
  "category": "General",
  "isActive": true,
  "createdAt": {
    "$date": "2024-02-11T00:00:00.000Z"
  },
  "updatedAt": {
    "$date": "2024-02-11T00:00:00.000Z"
  }
}
```

**6. Click "Insert"**

---

### Method 4: Using Prisma Studio

**1. Open terminal in backend directory**

**2. Run:**
```bash
npx prisma studio
```

**3. Browser opens at:** `http://localhost:5555`

**4. Click "PdfDocument" model** (left sidebar)

**5. Click "Add record"** (top right)

**6. Fill in fields:**
- title: `Investment Prospectus`
- description: `Official investment prospectus document`
- filePath: `public/pdfs/prospectus.pdf`
- fileUrl: `/pdfs/prospectus.pdf`
- displayOrder: `1`
- category: `General`
- isActive: ✓ (checked)

**7. Click "Save 1 change"**

---

## 📚 Field Reference

| Field | Required? | Description | Example |
|-------|-----------|-------------|---------|
| **title** | ✅ Required | Display name in menu | `"Investment Prospectus"` |
| **description** | ❌ Optional | Brief description | `"Official prospectus document"` |
| **filePath** | ✅ Required | Server file path | `"public/pdfs/prospectus.pdf"` |
| **fileUrl** | ✅ Required | Public URL path | `"/pdfs/prospectus.pdf"` |
| **displayOrder** | ❌ Optional | Menu order (lower = first) | `1` (default: 0) |
| **category** | ❌ Optional | Group by category | `"General"` (default) |
| **isActive** | ❌ Optional | Show/hide in menu | `true` (default) |

---

## 📝 Example: Add 3 Common PDFs

### 1. Investment Prospectus

**File:** Copy `prospectus.pdf` to `public/pdfs/`

**Database JSON:**
```json
{
  "title": "Investment Prospectus",
  "description": "Official investment prospectus document",
  "filePath": "public/pdfs/prospectus.pdf",
  "fileUrl": "/pdfs/prospectus.pdf",
  "displayOrder": 1,
  "category": "General"
}
```

**Using Postman:** POST to `http://localhost:4001/api/pdf/documents` with above JSON

---

### 2. Terms & Conditions

**File:** Copy `terms-and-conditions.pdf` to `public/pdfs/`

**Database JSON:**
```json
{
  "title": "Terms & Conditions",
  "description": "Legal terms and conditions",
  "filePath": "public/pdfs/terms-and-conditions.pdf",
  "fileUrl": "/pdfs/terms-and-conditions.pdf",
  "displayOrder": 2,
  "category": "Legal"
}
```

---

### 3. Annual Report 2024

**File:** Copy `annual-report-2024.pdf` to `public/pdfs/`

**Database JSON:**
```json
{
  "title": "Annual Report 2024",
  "description": "Annual financial report",
  "filePath": "public/pdfs/annual-report-2024.pdf",
  "fileUrl": "/pdfs/annual-report-2024.pdf",
  "displayOrder": 3,
  "category": "Financial"
}
```

---

## ✅ Verification

### 1. Check Database

**Using API:**
```bash
curl http://localhost:4001/api/pdf/documents
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "title": "Investment Prospectus",
      "fileUrl": "/pdfs/prospectus.pdf",
      "displayOrder": 1,
      "category": "General"
    }
  ]
}
```

### 2. Test File Access (With Passcode)

**Using Browser:**
```
http://localhost:4001/api/pdf/serve/prospectus.pdf?passcode=SecureCode123!
```

**Using cURL:**
```bash
curl -H "Authorization: Bearer SecureCode123!" \
  http://localhost:4001/api/pdf/serve/prospectus.pdf
```

Should stream the PDF file!

### 3. Check Frontend

1. Open frontend application
2. Navigate to "Documents" menu
3. Your PDF should appear in the list
4. Click it → passcode prompt → PDF viewer opens

---

## 🚨 Troubleshooting

### Problem: "PDF not found" error

**Solution 1:** Check file exists
```bash
dir "c:\Users\dfxMafia\Documents\startup-nextjs-main1\alvarado-backend\public\pdfs\"
```

**Solution 2:** Check filename matches database
- Database `fileUrl`: `/pdfs/prospectus.pdf`
- File must be: `public/pdfs/prospectus.pdf`

### Problem: "Passcode required" error

**Solution:** Ensure `PDF_ACCESS_PASSCODES` is set in `.env`:
```env
PDF_ACCESS_PASSCODES="SecureCode123!,AdminPass456#"
```

### Problem: API returns 401/403

**Solution:** Use correct API key in header:
```
X-API-Key: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
```

### Problem: PDF doesn't appear in frontend menu

**Check:**
1. `isActive` is `true` in database
2. Frontend is fetching from correct API endpoint
3. Clear browser cache and refresh

---

## 🎯 Quick Reference Card

**Upload Process:**
```
1. Copy PDF → public/pdfs/your-file.pdf
2. POST to /api/pdf/documents with:
   {
     "title": "...",
     "filePath": "public/pdfs/your-file.pdf",
     "fileUrl": "/pdfs/your-file.pdf",
     "displayOrder": 1
   }
3. Verify: GET /api/pdf/documents
4. Test: GET /api/pdf/serve/your-file.pdf?passcode=...
```

**API Endpoints:**
- Create: `POST /api/pdf/documents` (requires API key)
- List: `GET /api/pdf/documents` (public)
- Serve: `GET /api/pdf/serve/:filename` (requires passcode)

**Valid Passcodes (from .env):**
- `SecureCode123!`
- `AdminPass456#`
- `UserCode789@`
- `Partner2024`
- `Manager999`

---

## 🔒 Security Notes

- PDFs require passcode to access via `/api/pdf/serve/:filename`
- Direct access via `/pdfs/:filename` is blocked
- Admin API key required to create/update/delete PDF records
- Files stored in `public/pdfs/` but not publicly accessible without passcode

---

## 📦 Batch Upload Script (Coming Soon)

For uploading multiple PDFs at once, see:
- `scripts/batchUploadPdfs.ts` (coming soon)

Or use MongoDB Compass "Import Data" feature with CSV/JSON.
