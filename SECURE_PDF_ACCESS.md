# Secure PDF Access - Implementation Complete ✅

## Security Issue Fixed

**Problem:** PDFs were publicly accessible at `/pdfs/filename.pdf` without any authentication.

**Solution:** Removed static file serving and implemented secure PDF streaming through authenticated endpoint.

## How It Works Now

### Backend Changes

1. **Removed Static Serving**
   - Deleted: `app.use("/pdfs", express.static("public/pdfs"));`
   - PDFs are no longer accessible via direct URL

2. **Added Secure Endpoint**
   - New route: `GET /api/pdf/serve/:filename`
   - Requires valid passcode to access
   - Streams PDF file securely

3. **Passcode Verification**
   - Checks passcode before serving file
   - Supports Authorization header or query parameter
   - Verifies file exists in database and is active

## API Usage

### Secure PDF Access

```http
GET /api/pdf/serve/:filename
Authorization: Bearer YOUR_PASSCODE
```

**OR**

```http
GET /api/pdf/serve/:filename?passcode=YOUR_PASSCODE
```

### Example Requests

#### Using Authorization Header (Recommended)
```bash
curl -H "Authorization: Bearer SecureCode123!" \
  http://localhost:4001/api/pdf/serve/prospectus.pdf
```

#### Using Query Parameter (For iframe/embed)
```bash
curl http://localhost:4001/api/pdf/serve/prospectus.pdf?passcode=SecureCode123!
```

#### From Frontend (iframe)
```html
<iframe
  src="http://localhost:4001/api/pdf/serve/prospectus.pdf?passcode=SecureCode123!"
  width="100%"
  height="600px">
</iframe>
```

#### From Frontend (JavaScript fetch)
```javascript
const response = await fetch(
  'http://localhost:4001/api/pdf/serve/prospectus.pdf',
  {
    headers: {
      'Authorization': 'Bearer SecureCode123!'
    }
  }
);
const blob = await response.blob();
const url = URL.createObjectURL(blob);
window.open(url);
```

## Response Codes

- **200 OK** - PDF file streamed successfully
- **401 Unauthorized** - No passcode provided
- **403 Forbidden** - Invalid passcode
- **404 Not Found** - PDF file not found in database or filesystem
- **500 Internal Server Error** - Server error

## Response Headers

```
Content-Type: application/pdf
Content-Length: [file size in bytes]
Content-Disposition: inline; filename="[filename]"
Cache-Control: private, max-age=3600
```

## Frontend Integration

### Update fileUrl in Database

The database records should now point to the secure endpoint:

**OLD (Insecure):**
```json
{
  "fileUrl": "/pdfs/prospectus.pdf"
}
```

**NEW (Secure):**
```json
{
  "fileUrl": "/api/pdf/serve/prospectus.pdf"
}
```

### Frontend Code Example

```javascript
// Get passcode from user or storage
const passcode = localStorage.getItem('pdfPasscode');

// Construct secure URL
const pdfUrl = `/api/pdf/serve/prospectus.pdf?passcode=${encodeURIComponent(passcode)}`;

// Use in PDF viewer
<iframe src={pdfUrl} />
```

## Migration Steps

### 1. Update Database Records

Update all existing PDF documents to use the new secure endpoint:

```javascript
// Using MongoDB Compass or Prisma
await prisma.pdfDocument.updateMany({
  where: {
    fileUrl: {
      startsWith: '/pdfs/'
    }
  },
  data: {
    fileUrl: {
      // This won't work in Prisma, do it manually or use script
    }
  }
});
```

**Manual Update Script:**
```javascript
const documents = await prisma.pdfDocument.findMany({
  where: {
    fileUrl: { startsWith: '/pdfs/' }
  }
});

for (const doc of documents) {
  const filename = doc.fileUrl.replace('/pdfs/', '');
  await prisma.pdfDocument.update({
    where: { id: doc.id },
    data: {
      fileUrl: `/api/pdf/serve/${filename}`
    }
  });
}
```

### 2. Update Frontend PDF Viewer

The frontend needs to append the passcode to the URL:

```javascript
// Before
const pdfUrl = document.fileUrl; // "/pdfs/prospectus.pdf"

// After
const passcode = verifiedPasscode; // From passcode verification
const pdfUrl = `${document.fileUrl}?passcode=${encodeURIComponent(passcode)}`;
```

### 3. Test Access

```bash
# Should fail (no passcode)
curl http://localhost:4001/api/pdf/serve/prospectus.pdf

# Should succeed (valid passcode)
curl -H "Authorization: Bearer SecureCode123!" \
  http://localhost:4001/api/pdf/serve/prospectus.pdf
```

## Security Benefits

✅ **Passcode Required** - PDFs cannot be accessed without valid passcode
✅ **No Direct Access** - Direct file URLs no longer work
✅ **Database Verification** - Only active PDFs in database can be accessed
✅ **Filesystem Check** - Verifies file exists before streaming
✅ **Secure Streaming** - File is streamed, not exposed via static route
✅ **Proper Headers** - Sets correct content type and caching headers

## Important Notes

1. **Backward Compatibility:** Old URLs like `/pdfs/filename.pdf` will no longer work
2. **Frontend Update Required:** Frontend must append passcode to new secure URLs
3. **Database Migration:** All existing fileUrl values must be updated
4. **Performance:** Streaming adds minimal overhead compared to static serving
5. **Caching:** Browser caches PDF for 1 hour (adjustable in controller)

## File Locations

- **Controller:** `src/controllers/pdf.controller.ts` - `servePdfFile()` function
- **Routes:** `src/routes/pdf.routes.ts` - `GET /api/pdf/serve/:filename`
- **App Config:** `src/app.ts` - Static serving removed

## Testing Checklist

- [ ] Verify direct access to `/pdfs/filename.pdf` returns 404
- [ ] Verify `/api/pdf/serve/filename.pdf` without passcode returns 401
- [ ] Verify `/api/pdf/serve/filename.pdf` with invalid passcode returns 403
- [ ] Verify `/api/pdf/serve/filename.pdf` with valid passcode streams PDF
- [ ] Verify frontend PDF viewer works with new secure URLs
- [ ] Update all database records to new URL format
- [ ] Test on production (Render deployment)

## Next Steps

1. Run the database migration script to update all fileUrl values
2. Update frontend to append passcode to PDF URLs
3. Test thoroughly in development
4. Deploy to production
5. Verify production PDFs are not directly accessible

## Environment Variables

No new environment variables needed. Uses existing:
- `PDF_ACCESS_PASSCODES` - Comma-separated list of valid passcodes

## Example Production URLs

**Before (Insecure):**
```
https://alvarado-backend.onrender.com/pdfs/prospectus.pdf
```

**After (Secure):**
```
https://alvarado-backend.onrender.com/api/pdf/serve/prospectus.pdf?passcode=SecureCode123!
```
