# PDF Dynamic Management - Implementation Complete ✅

## Overview

PDFs are now managed dynamically from the MongoDB database using Prisma. No frontend code changes needed to add/remove/update PDFs.

## Database Model

### PdfDocument Schema

```typescript
model PdfDocument {
  id           String   @id @default(auto()) @map("_id") @db.ObjectId
  title        String   // Display name in menu
  description  String   @default("") // Optional description
  filePath     String   // Server file path (backend reference)
  fileUrl      String   // Public URL path (frontend uses this)
  displayOrder Int      @default(0) // Order in menu (lower = first)
  category     String   @default("General") // Optional: group PDFs by category
  isActive     Boolean  @default(true) // Toggle visibility
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

## API Endpoints

### Public Endpoints (No Auth Required)

#### 1. Get All Active PDFs
```http
GET /api/pdf/documents
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "title": "Investment Prospectus",
      "description": "Official investment prospectus document",
      "fileUrl": "/pdfs/prospectus.pdf",
      "displayOrder": 1,
      "category": "General"
    }
  ]
}
```

#### 2. Get Single PDF
```http
GET /api/pdf/documents/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "title": "Investment Prospectus",
    "fileUrl": "/pdfs/prospectus.pdf"
  }
}
```

#### 3. Verify PDF Passcode
```http
POST /api/pdf/verify-passcode
Content-Type: application/json

{
  "passcode": "SecureCode123!"
}
```

### Admin Endpoints (Requires Admin API Key or Admin Role)

#### 4. Create PDF Document
```http
POST /api/pdf/documents
X-API-Key: your-admin-api-key
Content-Type: application/json

{
  "title": "Annual Report 2024",
  "description": "Annual financial report",
  "filePath": "/pdfs/annual-report-2024.pdf",
  "fileUrl": "/pdfs/annual-report-2024.pdf",
  "displayOrder": 1,
  "category": "Financial"
}
```

#### 5. Update PDF Document
```http
PUT /api/pdf/documents/:id
X-API-Key: your-admin-api-key
Content-Type: application/json

{
  "title": "Updated Title",
  "displayOrder": 2,
  "isActive": true
}
```

#### 6. Delete PDF Document (Soft Delete)
```http
DELETE /api/pdf/documents/:id
X-API-Key: your-admin-api-key
```

## Adding PDF Documents

### Method 1: Using MongoDB Compass

1. Open MongoDB Compass
2. Connect to your database
3. Navigate to `alvarado` database → `pdfDocuments` collection
4. Click "INSERT DOCUMENT"
5. Add document:

```json
{
  "title": "Investment Prospectus",
  "description": "Official investment prospectus document",
  "filePath": "/pdfs/prospectus.pdf",
  "fileUrl": "/pdfs/prospectus.pdf",
  "displayOrder": 1,
  "category": "General",
  "isActive": true,
  "createdAt": { "$date": "2024-02-11T00:00:00.000Z" },
  "updatedAt": { "$date": "2024-02-11T00:00:00.000Z" }
}
```

### Method 2: Using Prisma Studio

```bash
npx prisma studio
```

1. Navigate to `PdfDocument` model
2. Click "Add record"
3. Fill in the fields
4. Click "Save 1 change"

### Method 3: Using API (cURL)

```bash
curl -X POST http://localhost:4001/api/pdf/documents \
  -H "Content-Type: application/json" \
  -H "X-API-Key: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2" \
  -d '{
    "title": "Terms & Conditions",
    "description": "Legal terms and conditions",
    "filePath": "/pdfs/terms.pdf",
    "fileUrl": "/pdfs/terms.pdf",
    "displayOrder": 2,
    "category": "Legal"
  }'
```

### Method 4: Using Postman

- Method: `POST`
- URL: `http://localhost:4001/api/pdf/documents`
- Headers:
  - `Content-Type: application/json`
  - `X-API-Key: your-admin-api-key`
- Body (raw JSON):
```json
{
  "title": "Property Catalog",
  "description": "Complete property listings",
  "filePath": "/pdfs/property-catalog.pdf",
  "fileUrl": "/pdfs/property-catalog.pdf",
  "displayOrder": 3,
  "category": "Properties"
}
```

## Sample PDFs to Add

```javascript
// Insert these documents into MongoDB
const samplePDFs = [
  {
    title: "Investment Prospectus",
    description: "Official investment prospectus document",
    filePath: "/pdfs/prospectus.pdf",
    fileUrl: "/pdfs/prospectus.pdf",
    displayOrder: 1,
    category: "General",
    isActive: true
  },
  {
    title: "Terms & Conditions",
    description: "Legal terms and conditions",
    filePath: "/pdfs/terms.pdf",
    fileUrl: "/pdfs/terms.pdf",
    displayOrder: 2,
    category: "Legal",
    isActive: true
  },
  {
    title: "Annual Report 2024",
    description: "Annual financial report",
    filePath: "/pdfs/annual-report-2024.pdf",
    fileUrl: "/pdfs/annual-report-2024.pdf",
    displayOrder: 3,
    category: "Financial",
    isActive: true
  },
  {
    title: "Property Catalog",
    description: "Complete property listings",
    filePath: "/pdfs/property-catalog.pdf",
    fileUrl: "/pdfs/property-catalog.pdf",
    displayOrder: 4,
    category: "Properties",
    isActive: true
  }
];
```

## Managing PDFs

### Update a PDF

```bash
curl -X PUT http://localhost:4001/api/pdf/documents/507f1f77bcf86cd799439011 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-admin-api-key" \
  -d '{
    "title": "Updated Title",
    "displayOrder": 1
  }'
```

### Deactivate a PDF (Hide from Menu)

```bash
curl -X DELETE http://localhost:4001/api/pdf/documents/507f1f77bcf86cd799439011 \
  -H "X-API-Key: your-admin-api-key"
```

### Reactivate a PDF

```bash
curl -X PUT http://localhost:4001/api/pdf/documents/507f1f77bcf86cd799439011 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-admin-api-key" \
  -d '{
    "isActive": true
  }'
```

## Frontend Integration

The frontend automatically fetches PDFs from `/api/pdf/documents` and displays them in the header menu under "Documents".

### How It Works

1. **Header Component Mounts**
   - Fetches `GET /api/pdf/documents`
   - Backend returns all active PDFs sorted by displayOrder

2. **Menu Updates**
   - Transforms PDF data into menu items
   - Updates Documents submenu dynamically

3. **User Clicks PDF**
   - Passcode modal appears (if not authenticated)
   - After verification, opens PDF viewer with `fileUrl`

### Example Menu Transformation

API Response → Menu Item:
```javascript
{
  title: "Investment Prospectus",
  fileUrl: "/pdfs/prospectus.pdf"
}
```
becomes:
```javascript
{
  id: 41,
  title: "Investment Prospectus",
  path: "/pdf-viewer?file=%2Fpdfs%2Fprospectus.pdf",
  newTab: true
}
```

## Testing

### Test the API

```bash
# Get all PDFs
curl http://localhost:4001/api/pdf/documents

# Get single PDF
curl http://localhost:4001/api/pdf/documents/507f1f77bcf86cd799439011

# Create PDF (admin)
curl -X POST http://localhost:4001/api/pdf/documents \
  -H "Content-Type: application/json" \
  -H "X-API-Key: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2" \
  -d '{
    "title": "Test Document",
    "filePath": "/pdfs/test.pdf",
    "fileUrl": "/pdfs/test.pdf",
    "displayOrder": 99
  }'
```

## Deployment Checklist

- [ ] Add sample PDF documents to production database
- [ ] Upload actual PDF files to `/public/pdfs/` or CDN
- [ ] Deploy backend with PDF document endpoints
- [ ] Verify frontend fetches and displays PDFs correctly
- [ ] Test passcode protection still works
- [ ] Test admin endpoints with API key
- [ ] Document which passcode provides access

## Benefits

✅ **No Code Changes** - Add/remove PDFs without touching code
✅ **Centralized** - All PDF info in MongoDB
✅ **Flexible** - Easy to add categories, descriptions, permissions
✅ **Scalable** - Can add hundreds of PDFs
✅ **Maintainable** - Manage via database or API
✅ **Consistent** - Same passcode protection for all PDFs

## Future Enhancements

- [ ] Group PDFs by category in submenu
- [ ] Different passcodes for different categories
- [ ] Track PDF views and downloads
- [ ] Search PDFs by title/description
- [ ] Admin panel UI for PDF management
- [ ] PDF versioning
- [ ] Auto-expire PDFs after certain date
- [ ] Upload PDFs directly through admin panel

## Files Modified

- `prisma/schema.prisma` - Added PdfDocument model
- `src/controllers/pdf.controller.ts` - Added CRUD operations
- `src/routes/pdf.routes.ts` - Added document endpoints

## Notes

- PDFs are sorted by `displayOrder` (ascending) then `title` (alphabetically)
- `isActive: false` hides PDF from menu without deleting
- `fileUrl` is used by frontend, `filePath` for backend reference
- Admin endpoints require `X-API-Key` header or admin JWT token
- Public endpoints are cached by frontend on mount
