# PDF Files Directory

This directory stores all PDF documents that are served through the application.

## 📂 Directory Structure

```
public/
  └── pdfs/
      ├── prospectus.pdf
      ├── terms.pdf
      ├── annual-report-2024.pdf
      └── property-catalog.pdf
```

## 📤 How to Upload PDFs

### Local Development:

1. **Add PDF files to this directory:**
   - Copy your PDF files to: `c:\Users\dfxMafia\Documents\startup-nextjs-main1\alvarado-backend\public\pdfs\`
   - Example: `prospectus.pdf`, `terms.pdf`, etc.

2. **Add to database:**
   Use MongoDB Compass, Prisma Studio, or API to add document records:

   ```json
   {
     "title": "Investment Prospectus",
     "description": "Official investment prospectus",
     "filePath": "public/pdfs/prospectus.pdf",
     "fileUrl": "/pdfs/prospectus.pdf",
     "displayOrder": 1,
     "category": "General",
     "isActive": true
   }
   ```

3. **Test access:**
   - Local: `http://localhost:4001/pdfs/prospectus.pdf`
   - Frontend will use: `/pdfs/prospectus.pdf`

### Production Deployment (Render):

#### Option A: Include PDFs in Git (Small Files < 10MB)

1. Add PDFs to this directory
2. Update `.gitignore` if needed to allow PDFs:
   ```
   # Allow PDFs in public/pdfs
   !public/pdfs/*.pdf
   ```
3. Commit and push:
   ```bash
   git add public/pdfs/*.pdf
   git commit -m "Add PDF documents"
   git push origin main
   ```

#### Option B: Use Cloud Storage (Recommended for Large Files)

Upload PDFs to Cloudinary (you're already using it):

```bash
# Upload to Cloudinary
curl -X POST https://api.cloudinary.com/v1_1/dlsrtoilw/raw/upload \
  -F "file=@prospectus.pdf" \
  -F "upload_preset=YOUR_PRESET" \
  -F "resource_type=raw"
```

Then use the Cloudinary URL in database:
```json
{
  "fileUrl": "https://res.cloudinary.com/dlsrtoilw/raw/upload/v1234/prospectus.pdf"
}
```

#### Option C: Render Persistent Disk (Advanced)

For large files that shouldn't be in Git:

1. Add persistent disk in Render dashboard
2. Mount to `/var/data/pdfs`
3. Update app.ts:
   ```javascript
   app.use("/pdfs", express.static("/var/data/pdfs"));
   ```
4. Upload PDFs via SFTP or Render shell

## 🔗 URLs After Upload

Once a PDF is in `public/pdfs/`, it's accessible at:

- **Local:** `http://localhost:4001/pdfs/filename.pdf`
- **Production:** `https://your-backend.onrender.com/pdfs/filename.pdf`

The frontend uses relative paths like `/pdfs/filename.pdf` which work automatically.

## 📋 Example: Adding a New PDF

1. **Copy PDF file:**
   ```bash
   # Windows
   copy "C:\Downloads\prospectus.pdf" "public\pdfs\prospectus.pdf"

   # Mac/Linux
   cp ~/Downloads/prospectus.pdf public/pdfs/prospectus.pdf
   ```

2. **Add to database using API:**
   ```bash
   curl -X POST http://localhost:4001/api/pdf/documents \
     -H "Content-Type: application/json" \
     -H "X-API-Key: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2" \
     -d '{
       "title": "Investment Prospectus",
       "description": "Official investment prospectus document",
       "filePath": "public/pdfs/prospectus.pdf",
       "fileUrl": "/pdfs/prospectus.pdf",
       "displayOrder": 1,
       "category": "General"
     }'
   ```

3. **Verify access:**
   - Open: `http://localhost:4001/pdfs/prospectus.pdf`
   - Should display the PDF

4. **Frontend will automatically fetch and display it in menu!**

## 🎯 Recommended Approach

**For Development:**
- Store PDFs in `public/pdfs/` directory
- Small test PDFs are fine in Git

**For Production:**
- **Files < 10MB:** Include in Git, deploy with app
- **Files > 10MB:** Use Cloudinary or persistent disk
- **Many files:** Use Cloudinary for better CDN performance

## ⚠️ Important Notes

- Maximum file size in Git: ~100MB (but keep under 10MB for best performance)
- PDFs are publicly accessible once uploaded (passcode only in frontend)
- Server must restart after adding files in development
- Cloudinary offers better performance and CDN distribution
- Consider using Cloudinary for production deployments

## 📝 File Naming Conventions

Use lowercase, hyphens for spaces, no special characters:
- ✅ `investment-prospectus.pdf`
- ✅ `terms-and-conditions.pdf`
- ✅ `annual-report-2024.pdf`
- ❌ `Investment Prospectus.pdf` (spaces)
- ❌ `terms&conditions.pdf` (special chars)

## 🔍 Troubleshooting

**PDF not loading:**
1. Check file exists: `dir public\pdfs\` (Windows) or `ls public/pdfs/` (Mac/Linux)
2. Check URL: `http://localhost:4001/pdfs/filename.pdf`
3. Check database record has correct `fileUrl`
4. Restart backend server

**File too large:**
1. Compress PDF using online tools
2. Or upload to Cloudinary instead
3. Update database record with Cloudinary URL
