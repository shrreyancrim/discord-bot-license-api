# Discord Bot License Verification API

A secure API service for managing and verifying Discord bot licenses using MongoDB with comprehensive license tracking.

## Features

- ✅ Secure API key authentication
- ✅ MongoDB integration for license storage
- ✅ Rate limiting (100 requests per minute)
- ✅ License expiration checking with lifetime support
- ✅ **Automatic guild tracking** - tracks which Discord servers are using each license
- ✅ **Guild limit enforcement** - prevents licenses from being used on more servers than allowed
- ✅ Product and owner management
- ✅ Active/inactive status management
- ✅ Full CRUD operations for licenses
- ✅ Usage analytics and verification logging
- ✅ Metadata tracking (notes, reseller info)
- ✅ Verification checksum support

## License Structure

The comprehensive license structure includes:

```typescript
{
  _id: string,                          // MongoDB document ID (optional)
  licenseKey: string,                   // Unique license identifier
  product: {
    name: string,                       // Product name (e.g., "Crim Tickets")
    id: string                          // Product ID (e.g., "prod_001")
  },
  owner: {
    userId: string,                     // User/client ID
    email: string                       // Owner email
  },
  validity: {
    issuedAt: Date,                     // License issue date
    expiresAt: Date | "never",          // Expiration date or "never"
    durationDays: number | "lifetime"   // Duration or "lifetime"
  },
  status: "active" | "inactive",        // License status
  activation: {
    maxGuilds: number,                  // Maximum allowed Discord servers
    activeGuilds: string[]              // Array of active Discord server IDs
  },
  metadata: {
    notes: string,                      // Additional notes
    reseller: string                    // Reseller information
  },
  verification: {
    lastVerified: Date,                 // Last verification timestamp
    checksum: string                    // Verification checksum
  }
}
```

## API Endpoints

### License Verification

#### POST `/api/verify-license`

Verify if a license key is valid and automatically track the Discord server.

**How it works:**
- When your bot starts in a guild, call this endpoint with the `discordServerId`
- The API will automatically add the guild to `activeGuilds` if under the limit
- If the guild is already active, verification succeeds without changes
- If the maximum guild limit is reached, verification fails

**Authentication:** Required (X-API-Key or Authorization Bearer)

**Request:**
```json
{
  "licenseKey": "LM-2F7A9C-D3E8F1-H5K2L0",
  "discordServerId": "123456789012345678"
}
```

**Note:** `discordServerId` is **required** for all verification requests. An optional `deviceId` field can be included for additional tracking if needed.

**Response (Valid):**
```json
{
  "valid": true,
  "message": "License is valid",
  "license": {
    "licenseKey": "LM-2F7A9C-D3E8F1-H5K2L0",
    "product": {
      "name": "Crim Tickets",
      "id": "prod_001"
    },
    "owner": {
      "userId": "usr_12345",
      "email": "client@example.com"
    },
    "status": "active",
    "validity": {
      "issuedAt": "2025-11-10T00:00:00.000Z",
      "expiresAt": "never",
      "durationDays": "lifetime"
    },
    "activation": {
      "maxGuilds": 1,
      "activeGuilds": ["123456789012345678"]
    }
  }
}
```

**Response (Invalid - Expired):**
```json
{
  "valid": false,
  "message": "License has expired",
  "expiresAt": "2024-12-31T23:59:59.000Z"
}
```

**Response (Invalid - Max Guilds Reached):**
```json
{
  "valid": false,
  "message": "Maximum number of guilds reached for this license",
  "maxGuilds": 1,
  "activeGuilds": 1
}
```

### License Management

#### POST `/api/licenses`

Create a new license.

**Authentication:** Required

**Request:**
```json
{
  "licenseKey": "LM-2F7A9C-D3E8F1-H5K2L0",
  "product": {
    "name": "Crim Tickets",
    "id": "prod_001"
  },
  "owner": {
    "userId": "usr_12345",
    "email": "client@example.com"
  },
  "validity": {
    "issuedAt": "2025-11-10T00:00:00Z",
    "expiresAt": "never",
    "durationDays": "lifetime"
  },
  "status": "active",
  "activation": {
    "maxGuilds": 1,
    "activeGuilds": []
  },
  "metadata": {
    "notes": "Client: Shrreyan, Crim Tickets",
    "reseller": "BuiltByBit"
  },
  "verification": {
    "lastVerified": "2025-11-10T18:31:00Z",
    "checksum": "c42aebf0e5195c8b930a1b1e1ab9d7f8"
  }
}
```

**Response:**
```json
{
  "message": "License created successfully",
  "license": { ... }
}
```

#### GET `/api/licenses`

Get all licenses.

**Authentication:** Required

**Response:**
```json
{
  "licenses": [...],
  "count": 10
}
```

#### GET `/api/licenses/:licenseKey`

Get a specific license.

**Authentication:** Required

**Response:**
```json
{
  "license": { ... }
}
```

#### PUT `/api/licenses/:licenseKey`

Update a license. You can update any nested fields.

**Authentication:** Required

**Request (Update Status):**
```json
{
  "status": "inactive"
}
```

**Request (Update Activation):**
```json
{
  "activation": {
    "maxGuilds": 5
  }
}
```

**Request (Update Product Info):**
```json
{
  "product": {
    "name": "Updated Product Name"
  }
}
```

**Response:**
```json
{
  "message": "License updated successfully",
  "license": { ... }
}
```

#### POST `/api/licenses/:licenseKey/deactivate`

Remove a Discord server from the license's active guilds. **Call this when your bot leaves a server or shuts down.**

**Authentication:** Required

**Request:**
```json
{
  "discordServerId": "123456789012345678"
}
```

**Response:**
```json
{
  "message": "Guild deactivated successfully",
  "license": { ... }
}
```

**Error (Guild Not Active):**
```json
{
  "error": "Guild is not active for this license",
  "activeGuilds": []
}
```

**Important:** Without calling this endpoint when your bot shuts down, the guild slot will remain occupied. For production use, implement proper cleanup on bot shutdown events.

#### DELETE `/api/licenses/:licenseKey`

Delete a license.

**Authentication:** Required

**Response:**
```json
{
  "message": "License deleted successfully"
}
```

### Analytics

#### GET `/api/analytics/logs`

Get verification logs for analytics.

**Authentication:** Required

**Query Parameters:**
- `licenseKey` (optional) - Filter by specific license
- `limit` (optional) - Limit results (default: 100)

**Response:**
```json
{
  "logs": [
    {
      "licenseKey": "LM-2F7A9C-D3E8F1-H5K2L0",
      "discordServerId": "123456789012345678",
      "success": true,
      "reason": "Valid license",
      "timestamp": "2025-11-10T12:00:00.000Z",
      "ipAddress": "192.168.1.1"
    }
  ],
  "count": 50
}
```

### Health Check

#### GET `/api/health`

Check API status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-10T12:00:00.000Z"
}
```

## MongoDB Collections

### Licenses Collection
```javascript
{
  "_id": "b4e12c93-91b7-4d0e-9e3e-3a0b2f1b1c90",
  "licenseKey": "LM-2F7A9C-D3E8F1-H5K2L0",
  "product": {
    "name": "Crim Tickets",
    "id": "prod_001"
  },
  "owner": {
    "userId": "usr_12345",
    "email": "client@example.com"
  },
  "validity": {
    "issuedAt": ISODate("2025-11-10T00:00:00.000Z"),
    "expiresAt": "never",  // or ISODate for actual date
    "durationDays": "lifetime"  // or number for days
  },
  "status": "active",
  "activation": {
    "maxGuilds": 1,
    "activeGuilds": []
  },
  "metadata": {
    "notes": "Client: Shrreyan, Crim Tickets",
    "reseller": "BuiltByBit"
  },
  "verification": {
    "lastVerified": ISODate("2025-11-10T18:31:00.000Z"),
    "checksum": "c42aebf0e5195c8b930a1b1e1ab9d7f8"
  }
}
```

### Verification Logs Collection
```javascript
{
  "licenseKey": "LM-2F7A9C-D3E8F1-H5K2L0",
  "discordServerId": "123456789012345678",
  "success": true,
  "reason": "Valid license",
  "timestamp": ISODate("2025-11-10T12:00:00.000Z"),
  "ipAddress": "192.168.1.1"
}
```

## Example Usage

### Discord Bot Integration

```javascript
const fetch = require('node-fetch');

// Verify license when bot starts (automatically adds guild to activeGuilds)
async function verifyLicense(licenseKey, guildId) {
  const response = await fetch('https://your-api-url/api/verify-license', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.API_KEY
    },
    body: JSON.stringify({
      licenseKey: licenseKey,
      discordServerId: guildId  // REQUIRED - guild ID where bot is running
    })
  });

  const data = await response.json();
  
  if (!data.valid) {
    console.error('License verification failed:', data.message);
    // Handle failed verification (e.g., shut down bot)
  }
  
  return data.valid;
}

// Deactivate guild when bot leaves or shuts down
async function deactivateLicense(licenseKey, guildId) {
  const response = await fetch(`https://your-api-url/api/licenses/${licenseKey}/deactivate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.API_KEY
    },
    body: JSON.stringify({
      discordServerId: guildId
    })
  });

  return await response.json();
}

// Example: Discord.js bot setup
client.on('ready', async () => {
  const guild = client.guilds.cache.first();
  const isValid = await verifyLicense(process.env.LICENSE_KEY, guild.id);
  
  if (!isValid) {
    console.error('Invalid license! Shutting down...');
    process.exit(1);
  }
});

// Clean up when bot shuts down
process.on('SIGINT', async () => {
  const guild = client.guilds.cache.first();
  await deactivateLicense(process.env.LICENSE_KEY, guild.id);
  process.exit(0);
});
```

### Create License Programmatically
```javascript
async function createLicense(licenseData) {
  const response = await fetch('https://your-api-url/api/licenses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.API_KEY
    },
    body: JSON.stringify({
      licenseKey: "LM-2F7A9C-D3E8F1-H5K2L0",
      product: {
        name: "Crim Tickets",
        id: "prod_001"
      },
      owner: {
        userId: "usr_12345",
        email: "client@example.com"
      },
      validity: {
        issuedAt: "2025-11-10T00:00:00Z",
        expiresAt: "never",
        durationDays: "lifetime"
      },
      status: "active",
      activation: {
        maxGuilds: 1,
        activeGuilds: []
      },
      metadata: {
        notes: "Client: Shrreyan",
        reseller: "BuiltByBit"
      },
      verification: {
        lastVerified: new Date().toISOString(),
        checksum: "your-checksum-here"
      }
    })
  });

  return await response.json();
}
```

### Deactivate a License
```javascript
async function deactivateLicense(licenseKey) {
  const response = await fetch(`https://your-api-url/api/licenses/${licenseKey}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.API_KEY
    },
    body: JSON.stringify({
      status: "inactive"
    })
  });

  return await response.json();
}
```

### Get Analytics
```javascript
async function getAnalytics(licenseKey = null) {
  const url = licenseKey 
    ? `https://your-api-url/api/analytics/logs?licenseKey=${licenseKey}`
    : 'https://your-api-url/api/analytics/logs';

  const response = await fetch(url, {
    headers: {
      'X-API-Key': process.env.API_KEY
    }
  });

  return await response.json();
}
```

## Environment Variables

Set these in your Replit Secrets:

- `MONGODB_URI` - Your MongoDB connection string (required)
- `API_KEY` - Your secure API key for authentication (required)
- `TRUST_PROXY` - Set to `true` if deployed behind a reverse proxy/load balancer (optional)

### Trust Proxy Configuration

If you deploy this API behind a reverse proxy (like Nginx, Cloudflare, or when using Replit's published deployment), you should set `TRUST_PROXY=true` to enable accurate IP address logging and rate limiting.

**When to enable:**
- Deployed on Replit (published app)
- Behind a load balancer or reverse proxy
- Using a CDN like Cloudflare

**Security Note:** Only enable this if you trust your proxy infrastructure. When enabled, the API will use the `X-Forwarded-For` header to determine client IPs. Do not enable this if your API is directly exposed to the internet without a trusted proxy.

## Rate Limiting

- 100 requests per minute per IP address
- Rate limit headers included in response

## Migration Notes

If migrating from the old schema to the new comprehensive schema:

1. The old fields `isActive`, `discordServerId`, `expiresAt`, and `createdAt` have been restructured
2. Use `status` instead of `isActive` (values: "active" or "inactive")
3. Expiration is now in `validity.expiresAt` and can be "never" for lifetime licenses
4. New required fields: `product`, `owner`, `activation`, `metadata`, `verification`
5. All existing licenses will need to be migrated to include the new structure
