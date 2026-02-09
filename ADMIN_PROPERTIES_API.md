# Admin Properties API Documentation

Complete CRUD API for managing investment properties via Postman.

## Authentication

All endpoints require the `ADMIN_API_KEY` in the Authorization header:

```
Authorization: Bearer YOUR_ADMIN_API_KEY
```

Get your API key from `backend/.env` → `ADMIN_API_KEY` variable.

---

## Base URL

```
http://localhost:4000/api/admin/properties
```

---

## Endpoints

### 1. **Get All Properties**

**GET** `/api/admin/properties`

**Query Parameters (optional):**
- `category` - Filter by: `arbitrage`, `mortgage`, or `airbnb`
- `investmentType` - Filter by: `individual` or `pooled`
- `status` - Filter by: `available`, `fully-funded`, `coming-soon`, or `closed`
- `type` - Filter by: `residential`, `commercial`, or `land`
- `featured` - Filter by: `true` or `false`
- `active` - Filter by: `true` or `false`

**Example:**
```
GET http://localhost:4000/api/admin/properties?category=airbnb&active=true
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "65f...",
      "title": "Luxury Condo Downtown Miami",
      "images": ["/images/properties/property-01.jpg"],
      "location": "Miami, FL",
      "price": 450000,
      "type": "residential",
      "category": "airbnb",
      "investmentType": "pooled",
      "minInvestment": 2500,
      "maxInvestment": 50000,
      "targetAmount": 450000,
      "currentFunded": 180000,
      "investorCount": 12,
      "expectedROI": 18,
      "monthlyReturn": 1.5,
      "duration": 24,
      "bedrooms": 2,
      "bathrooms": 2,
      "parking": 1,
      "sqft": 1200,
      "description": "Modern luxury condo...",
      "features": ["Ocean View", "Pool", "Gym"],
      "investmentStatus": "available",
      "riskLevel": "low",
      "isActive": true,
      "isFeatured": true,
      "createdAt": "2026-02-08T...",
      "updatedAt": "2026-02-08T..."
    }
  ]
}
```

---

### 2. **Get Single Property**

**GET** `/api/admin/properties/:id`

**Example:**
```
GET http://localhost:4000/api/admin/properties/65f1234567890abcdef12345
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "65f...",
    "title": "Luxury Condo Downtown Miami",
    "images": [...],
    "location": "Miami, FL",
    ...
    "userInvestments": [
      {
        "id": "65f...",
        "userId": "65e...",
        "amount": 5000,
        "status": "active",
        "createdAt": "2026-02-08T..."
      }
    ]
  }
}
```

---

### 3. **Create Property**

**POST** `/api/admin/properties`

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_API_KEY
Content-Type: application/json
```

**Body (all fields):**
```json
{
  "title": "Luxury Condo Downtown Miami",
  "images": [
    "/images/properties/property-01.jpg",
    "/images/properties/property-01b.jpg"
  ],
  "location": "Miami, FL",
  "price": 450000,
  "type": "residential",
  "category": "airbnb",
  "investmentType": "pooled",
  "minInvestment": 2500,
  "maxInvestment": 50000,
  "targetAmount": 450000,
  "currentFunded": 0,
  "investorCount": 0,
  "expectedROI": 18,
  "monthlyReturn": 1.5,
  "duration": 24,
  "bedrooms": 2,
  "bathrooms": 2,
  "parking": 1,
  "sqft": 1200,
  "description": "Modern luxury condo with stunning ocean views in the heart of downtown Miami.",
  "features": ["Ocean View", "Pool", "Gym", "Concierge", "Parking"],
  "investmentStatus": "available",
  "riskLevel": "low",
  "isFeatured": false
}
```

**Required Fields:**
- `title` (string, 1-200 chars)
- `images` (array of URLs, 1-20 items)
- `location` (string, 1-200 chars)
- `price` (positive number)
- `minInvestment` (positive number)
- `maxInvestment` (positive number)
- `targetAmount` (positive number)
- `expectedROI` (number, 0-100)
- `monthlyReturn` (number, 0-100)
- `sqft` (positive integer)
- `description` (string, 10-2000 chars)

**Optional Fields with Defaults:**
- `type` (default: "residential")
- `category` (default: "arbitrage")
- `investmentType` (default: "individual")
- `currentFunded` (default: 0)
- `investorCount` (default: 0)
- `duration` (default: 12)
- `bedrooms` (default: 0)
- `bathrooms` (default: 0)
- `parking` (default: 0)
- `features` (default: [])
- `investmentStatus` (default: "available")
- `riskLevel` (default: "low")
- `isFeatured` (default: false)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "65f...",
    "title": "Luxury Condo Downtown Miami",
    ...
  },
  "message": "Property created successfully"
}
```

---

### 4. **Update Property**

**PUT** `/api/admin/properties/:id`

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_API_KEY
Content-Type: application/json
```

**Body (all fields optional):**
```json
{
  "title": "Updated Title",
  "price": 475000,
  "currentFunded": 200000,
  "investorCount": 15,
  "investmentStatus": "available",
  "isActive": true,
  "isFeatured": true
}
```

**Example - Mark as Fully Funded:**
```json
{
  "currentFunded": 450000,
  "investmentStatus": "fully-funded"
}
```

**Example - Feature/Unfeature:**
```json
{
  "isFeatured": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "65f...",
    "title": "Updated Title",
    ...
  },
  "message": "Property updated successfully"
}
```

---

### 5. **Soft Delete Property**

**DELETE** `/api/admin/properties/:id`

Sets `isActive: false`. Property won't appear in public listings but data is preserved.

**Example:**
```
DELETE http://localhost:4000/api/admin/properties/65f1234567890abcdef12345
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "65f...",
    "title": "Luxury Condo Downtown Miami",
    "isActive": false,
    ...
  },
  "message": "Property deleted successfully"
}
```

---

### 6. **Permanently Delete Property**

**DELETE** `/api/admin/properties/:id/permanent`

⚠️ **Warning:** Permanently removes property from database. Only allowed if there are NO investments.

**Example:**
```
DELETE http://localhost:4000/api/admin/properties/65f1234567890abcdef12345/permanent
```

**Response (success):**
```json
{
  "success": true,
  "data": null,
  "message": "Property permanently deleted"
}
```

**Response (has investments):**
```json
{
  "success": false,
  "message": "Cannot delete property with existing investments. Use soft delete instead."
}
```

---

## Field Validation Rules

### Enums

**type:**
- `residential`
- `commercial`
- `land`

**category:**
- `arbitrage`
- `mortgage`
- `airbnb`

**investmentType:**
- `individual` (single investor owns the whole property)
- `pooled` (multiple investors contribute to a shared property)

**investmentStatus:**
- `available` (open for investment)
- `fully-funded` (target reached)
- `coming-soon` (not yet available)
- `closed` (no longer accepting investments)

**riskLevel:**
- `low`
- `medium`
- `high`

### Number Constraints

- `price` - Must be positive
- `minInvestment` - Must be positive
- `maxInvestment` - Must be positive, should be ≥ minInvestment
- `targetAmount` - Must be positive
- `currentFunded` - Must be ≥ 0, typically ≤ targetAmount
- `investorCount` - Must be ≥ 0
- `expectedROI` - Must be 0-100 (percentage)
- `monthlyReturn` - Must be 0-100 (percentage)
- `duration` - Must be positive (months)
- `bedrooms` - Must be ≥ 0
- `bathrooms` - Must be ≥ 0
- `parking` - Must be ≥ 0
- `sqft` - Must be positive

### String Constraints

- `title` - 1-200 characters
- `location` - 1-200 characters
- `description` - 10-2000 characters
- `images` - 1-20 URLs, each must be valid URL format
- `features` - Max 50 items, each max 100 characters

---

## Common Use Cases

### Create a New Airbnb Property
```json
{
  "title": "Modern Apartment in SoHo",
  "images": ["/images/properties/soho-apt.jpg"],
  "location": "New York, NY",
  "price": 950000,
  "type": "residential",
  "category": "airbnb",
  "investmentType": "pooled",
  "minInvestment": 1000,
  "maxInvestment": 25000,
  "targetAmount": 950000,
  "expectedROI": 16,
  "monthlyReturn": 1.33,
  "duration": 24,
  "bedrooms": 2,
  "bathrooms": 1,
  "parking": 0,
  "sqft": 900,
  "description": "Prime SoHo location with high Airbnb demand year-round.",
  "features": ["City Views", "Recently Renovated", "Washer/Dryer"],
  "investmentStatus": "available",
  "riskLevel": "low"
}
```

### Update Investment Progress
```json
{
  "currentFunded": 500000,
  "investorCount": 42
}
```

### Mark as Coming Soon
```json
{
  "investmentStatus": "coming-soon",
  "isActive": true,
  "isFeatured": true
}
```

### Feature Property on Homepage
```json
{
  "isFeatured": true
}
```

---

## Error Responses

**400 - Validation Error:**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "price": "Price must be positive",
    "images": "At least 1 image is required"
  }
}
```

**401 - Missing Auth:**
```json
{
  "success": false,
  "message": "Authorization header is required"
}
```

**403 - Invalid API Key:**
```json
{
  "success": false,
  "message": "Invalid API key"
}
```

**404 - Not Found:**
```json
{
  "success": false,
  "message": "Property not found"
}
```

**500 - Server Error:**
```json
{
  "success": false,
  "message": "Failed to create property"
}
```

---

## Postman Setup

1. Create a new Postman collection called "Alvarado Admin - Properties"

2. Add environment variable:
   - Key: `admin_api_key`
   - Value: (your ADMIN_API_KEY from backend/.env)

3. Set collection-level Authorization:
   - Type: Bearer Token
   - Token: `{{admin_api_key}}`

4. Import all 6 endpoints above

5. Add example request bodies to POST/PUT requests

---

## Testing Workflow

1. **Create a property** → Note the returned `id`
2. **Get all properties** → Verify it appears in the list
3. **Get single property** → Use the `id` from step 1
4. **Update property** → Change some fields (e.g., mark as featured)
5. **Soft delete** → Set `isActive: false`
6. **Get all with filters** → Verify it no longer appears when `active=true`

---

## Notes

- All timestamps are ISO 8601 format (e.g., `2026-02-08T12:34:56.789Z`)
- Property IDs are MongoDB ObjectIds (24-character hex strings)
- Soft delete is preferred to preserve investment history
- Hard delete only works if `userInvestments` array is empty
- The `currentFunded` and `investorCount` fields can be manually updated or automatically updated by the investment creation endpoint
