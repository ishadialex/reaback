# Postman Bulk PDF Upload Guide

Quick guide to upload multiple PDFs at once using Postman Collection Runner.

---

## 🚀 Quick Setup (3 Steps)

### Step 1: Create Postman Request

1. **Open Postman**
2. **Create New Request:**
   - Method: `POST`
   - URL: `http://localhost:4001/api/pdf/documents`
   - Name: `Upload PDF Document`

3. **Add Headers:**
   ```
   Content-Type: application/json
   X-API-Key: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
   ```

4. **Body (raw, JSON):**
   ```json
   {
     "title": "{{title}}",
     "description": "{{description}}",
     "filePath": "{{filePath}}",
     "fileUrl": "{{fileUrl}}",
     "displayOrder": {{displayOrder}},
     "category": "{{category}}"
   }
   ```

5. **Save to Collection** (name it "PDF Management")

---

### Step 2: Edit CSV File

Open `pdfs-upload.csv` in the backend folder and edit:

```csv
title,description,filePath,fileUrl,displayOrder,category
Available Arbitrary Opportunities,Investment opportunities,public/pdfs/available -Arbitrary-Opportunities.pdf,/pdfs/available -Arbitrary-Opportunities.pdf,1,Investment
Investment Prospectus,Official prospectus,public/pdfs/prospectus.pdf,/pdfs/prospectus.pdf,2,General
```

**To add more PDFs:** Just add new lines!

**Template:**
```csv
Your PDF Title,Your description,public/pdfs/your-file.pdf,/pdfs/your-file.pdf,ORDER_NUMBER,Category
```

---

### Step 3: Run Collection

1. **Click "Runner"** (or "Run" button next to your collection)
2. **Select:**
   - Collection: `PDF Management`
   - Requests: Check `Upload PDF Document`
   - Data: Click "Select File" → Choose `pdfs-upload.csv`
3. **Click "Run PDF Management"**

✅ **Done!** All PDFs uploaded automatically!

---

## 📋 CSV Template for Copy-Paste

```csv
title,description,filePath,fileUrl,displayOrder,category
PDF Title 1,Description here,public/pdfs/file-1.pdf,/pdfs/file-1.pdf,1,General
PDF Title 2,Description here,public/pdfs/file-2.pdf,/pdfs/file-2.pdf,2,Legal
PDF Title 3,Description here,public/pdfs/file-3.pdf,/pdfs/file-3.pdf,3,Financial
```

---

## 🔧 Field Guidelines

| Field | Format | Example | Notes |
|-------|--------|---------|-------|
| **title** | Plain text | `Investment Prospectus` | What users see in menu |
| **description** | Plain text | `Official prospectus document` | Optional, can be empty |
| **filePath** | `public/pdfs/filename.pdf` | `public/pdfs/prospectus.pdf` | Server path |
| **fileUrl** | `/pdfs/filename.pdf` | `/pdfs/prospectus.pdf` | Public URL path |
| **displayOrder** | Number (no quotes) | `1` | Menu order (lower = first) |
| **category** | Plain text | `General` | Group PDFs by category |

**Important CSV Rules:**
- NO quotes around fields (unless they contain commas)
- Keep filePath and fileUrl synchronized
- displayOrder must be a number (no quotes)
- File must end with `.pdf`

---

## 📝 Example: Real PDFs

### Example 1: Basic Documents

```csv
title,description,filePath,fileUrl,displayOrder,category
Investment Prospectus,Official investment prospectus document,public/pdfs/prospectus.pdf,/pdfs/prospectus.pdf,1,Investment
Terms and Conditions,Legal terms and conditions,public/pdfs/terms.pdf,/pdfs/terms.pdf,2,Legal
Privacy Policy,Data privacy policy,public/pdfs/privacy.pdf,/pdfs/privacy.pdf,3,Legal
Annual Report 2024,2024 financial report,public/pdfs/annual-report-2024.pdf,/pdfs/annual-report-2024.pdf,4,Financial
```

### Example 2: Property Documents

```csv
title,description,filePath,fileUrl,displayOrder,category
Downtown Properties,Properties in downtown area,public/pdfs/downtown-properties.pdf,/pdfs/downtown-properties.pdf,1,Properties
Suburban Listings,Suburban property catalog,public/pdfs/suburban-listings.pdf,/pdfs/suburban-listings.pdf,2,Properties
Commercial Spaces,Commercial real estate opportunities,public/pdfs/commercial-spaces.pdf,/pdfs/commercial-spaces.pdf,3,Properties
```

### Example 3: Financial Documents

```csv
title,description,filePath,fileUrl,displayOrder,category
Q1 Report 2024,First quarter financial report,public/pdfs/q1-2024.pdf,/pdfs/q1-2024.pdf,1,Financial
Q2 Report 2024,Second quarter financial report,public/pdfs/q2-2024.pdf,/pdfs/q2-2024.pdf,2,Financial
Annual Summary,Year-end financial summary,public/pdfs/annual-summary.pdf,/pdfs/annual-summary.pdf,3,Financial
```

---

## ✅ Verification

### Check Uploads Worked

**In Postman:**
1. Create new request: `GET http://localhost:4001/api/pdf/documents`
2. Click "Send"
3. You should see all your uploaded PDFs in the response

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
    },
    ...
  ]
}
```

---

## 🚨 Troubleshooting

### Problem: "Invalid CSV format"
**Fix:** Ensure first line is the header:
```csv
title,description,filePath,fileUrl,displayOrder,category
```

### Problem: "displayOrder must be a number"
**Fix:** Don't use quotes around displayOrder:
```csv
Title,Description,path,url,1,Category  ← Correct (no quotes)
Title,Description,path,url,"1",Category  ← Wrong (has quotes)
```

### Problem: Request fails with 401
**Fix:** Add API key to headers:
```
X-API-Key: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
```

### Problem: "PDF not found" when accessing
**Fix:** Ensure physical PDF file exists at the filePath location

---

## 🎯 Quick Reference

**CSV Location:** `alvarado-backend/pdfs-upload.csv`

**Postman Setup:**
1. POST to `http://localhost:4001/api/pdf/documents`
2. Add header: `X-API-Key: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2`
3. Body uses `{{variable}}` syntax
4. Run with CSV file in Collection Runner

**Body Template:**
```json
{
  "title": "{{title}}",
  "description": "{{description}}",
  "filePath": "{{filePath}}",
  "fileUrl": "{{fileUrl}}",
  "displayOrder": {{displayOrder}},
  "category": "{{category}}"
}
```

---

## 📊 Categories You Can Use

Organize your PDFs with these categories (or create your own):

- `General` - General documents
- `Legal` - Terms, policies, contracts
- `Financial` - Reports, statements
- `Investment` - Prospectus, opportunities
- `Properties` - Real estate catalogs
- `Marketing` - Brochures, presentations
- `Technical` - Specifications, manuals
- `Reports` - Annual reports, summaries

---

## 🔄 Updating Existing PDFs

To update a PDF document:

**Request:**
```
PUT http://localhost:4001/api/pdf/documents/DOCUMENT_ID
X-API-Key: YOUR_API_KEY
```

**Body:**
```json
{
  "title": "Updated Title",
  "displayOrder": 10,
  "isActive": true
}
```

Can't bulk update yet, but you can delete and re-upload with new CSV.

---

## 🗑️ Deleting PDFs

**Request:**
```
DELETE http://localhost:4001/api/pdf/documents/DOCUMENT_ID
X-API-Key: YOUR_API_KEY
```

This soft-deletes (sets `isActive: false`). PDF won't appear in menu but data remains in database.

---

## 📦 Files Included

- `pdfs-upload.csv` - Ready-to-edit CSV template
- `POSTMAN_BULK_UPLOAD.md` - This guide
- `UPLOAD_PDFS_GUIDE.md` - Full upload documentation

---

## 💡 Tips

1. **Test with 1-2 PDFs first** before bulk uploading
2. **Keep CSV file** for easy updates later
3. **Use consistent naming** for filePath and fileUrl
4. **Back up CSV file** before making major changes
5. **Check file exists** at filePath before uploading record

---

## 🎓 Video Tutorial (If Needed)

1. Import Postman collection (if provided)
2. Select CSV file
3. Click Run
4. Verify uploads

That's it! 🎉
