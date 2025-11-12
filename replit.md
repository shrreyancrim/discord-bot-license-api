# Discord Bot License Verification API

## Overview

A comprehensive backend API service for managing and verifying Discord bot licenses. The system provides secure REST API endpoints for license creation, management, verification, analytics, and comprehensive license tracking. Built with MongoDB for data persistence and includes rate limiting and API key authentication.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (November 2024)

### November 12, 2024 - Guild-Based Activation System
- **Activation System Overhaul**: Converted from device-based to guild-based tracking for Discord bots
- **Automatic Guild Management**: Verification endpoint automatically adds guilds to activeGuilds array
- **Atomic Operations**: Implemented race-condition-safe MongoDB operations using $addToSet and limit checks
- **Guild Deactivation**: Added POST /api/licenses/:key/deactivate endpoint for clean bot shutdown
- **Required Discord Server ID**: Made discordServerId mandatory in verification requests for proper guild tracking
- **Schema Update**: Changed activation fields from maxDevices/activatedDevices to maxGuilds/activeGuilds array

### November 12, 2024 - Comprehensive License Schema Migration
- **Complete Schema Overhaul**: Migrated from simple license structure to comprehensive nested object model
- **New License Fields**: Added product, owner, validity, activation, metadata, and verification tracking
- **Lifetime License Support**: Added support for "never" expiring licenses and "lifetime" duration
- **Enhanced Verification**: Added optional device ID support and automatic lastVerified timestamp updates
- **Improved Data Validation**: Updated Zod schemas with proper union ordering for literal values
- **New MongoDB Indexes**: Added indexes for product.id, owner.userId, status, and validity.expiresAt

### November 12, 2024 - System Simplification and Bug Fixes
- **Removed BuildByBit Integration**: Removed webhook endpoint to focus on core license verification
- **Fixed License Update Bug**: Fixed issue where undefined fields in updates would be set to null instead of being ignored
- **Proxy Support**: Added optional `TRUST_PROXY` environment variable for accurate IP logging behind reverse proxies
- **Security Enhancement**: Trust proxy is disabled by default for security, must be explicitly enabled

### Phase 2 Complete - Full License Management System
- **License CRUD Operations**: Added complete create, read, update, delete endpoints for license management
- **Usage Analytics**: Implemented verification logging system tracking all attempts with success/failure, reasons, timestamps, and IP addresses
- **Enhanced Schema**: Extended data models to support license creation, updates, and verification logging
- **MongoDB Indexes**: Added unique index on licenseKey and indexes on verification logs for performance

## System Architecture

### Backend Architecture

**Framework**: Express.js with TypeScript
- Node.js server handling HTTP requests
- RESTful API design pattern
- Middleware-based request processing pipeline

**Database Layer**:
- **MongoDB** with native MongoDB driver
- Two collections:
  - `licenses` - License records with comprehensive nested structure
  - `verification_logs` - Verification attempt logs with indexes on licenseKey and timestamp
- Database abstraction through `IStorage` interface for maintainability
- Automatic index creation on startup

**API Endpoints**:

*License Verification:*
- `POST /api/verify-license` - Verify license validity with logging and guild tracking

*License Management (Authenticated):*
- `POST /api/licenses` - Create new license with full structure
- `GET /api/licenses` - List all licenses
- `GET /api/licenses/:key` - Get specific license
- `PUT /api/licenses/:key` - Update license (any nested field)
- `POST /api/licenses/:key/deactivate` - Remove guild from license when bot shuts down
- `DELETE /api/licenses/:key` - Delete license

*Analytics (Authenticated):*
- `GET /api/analytics/logs` - Get verification logs with optional filtering

*Health:*
- `GET /api/health` - Health check endpoint

**Authentication & Security**:
- API key-based authentication for all management endpoints
- Supports two authentication methods:
  - `X-API-Key` header
  - `Authorization: Bearer` token header
- Rate limiting: 100 requests per minute per IP
- Guild activation limits enforced
- Optional trust proxy support for accurate IP logging behind reverse proxies

**Data Validation**:
- Zod schemas for all request/response validation
- Separate schemas for creation, updates, verification requests, and logs
- ISO date string parsing with transformation to Date objects
- Proper union ordering for literal values ("never", "lifetime")
- Nested object validation for product, owner, validity, activation, metadata, verification
- Comprehensive error messages for validation failures

**Logging & Monitoring**:
- Custom logging middleware for API request tracking
- Verification attempt logging to MongoDB:
  - License key
  - Discord server ID (if provided)
  - Device ID (if provided)
  - Success/failure status
  - Failure reason
  - Timestamp
  - IP address
- Request logs include: HTTP method, path, status code, response time

**Error Handling**:
- Consistent JSON error responses
- HTTP status codes: 400 (validation), 401 (auth missing), 403 (auth invalid), 404 (not found), 409 (conflict), 500 (server error)
- Duplicate license key detection
- Maximum guild limit enforcement
- Database connection validation

### Data Models

**License Schema**:
```typescript
{
  _id?: string,                      // MongoDB document ID (optional)
  licenseKey: string,                // Unique identifier
  product: {
    name: string,                    // Product name (e.g., "Crim Tickets")
    id: string                       // Product ID (e.g., "prod_001")
  },
  owner: {
    userId: string,                  // User/client ID
    email: string                    // Owner email
  },
  validity: {
    issuedAt: Date,                  // License issue date
    expiresAt: Date | "never",       // Expiration date or "never"
    durationDays: number | "lifetime" // Duration in days or "lifetime"
  },
  status: "active" | "inactive",     // License status
  activation: {
    maxGuilds: number,               // Maximum allowed guilds
    activeGuilds: string[]           // Array of active guild IDs
  },
  metadata: {
    notes: string,                   // Additional notes
    reseller: string                 // Reseller information
  },
  verification: {
    lastVerified: Date,              // Last verification timestamp
    checksum: string                 // Verification checksum
  }
}
```

**Verification Log Schema**:
```typescript
{
  licenseKey: string,
  discordServerId?: string,
  deviceId?: string,
  success: boolean,
  reason?: string,              // "Valid license", "License not found", etc.
  timestamp: Date,
  ipAddress?: string
}
```

### Frontend Architecture

**Framework**: React with TypeScript (Scaffolded but not used)
- Vite build tool for development and production builds
- React Router (Wouter) for routing
- React Query (TanStack Query) for server state management

**Current Frontend State**: 
The frontend is scaffolded but minimal - only a 404 page exists. The system is purely a backend API service.

### Build & Development

**Development**:
- TypeScript for type safety across the stack
- Hot module replacement via Vite in development
- TSX for server-side execution
- MongoDB indexes created automatically on startup

**Production Build**:
- Vite bundles the frontend to `dist/public`
- esbuild bundles the backend to `dist/index.js`
- ESM module format throughout

### External Dependencies

**Core Runtime**:
- Node.js with ES Modules
- Express.js web framework
- express-rate-limit for throttling

**Database**:
- MongoDB native driver
- Unique and compound indexes for performance
- Indexes on: licenseKey (unique), product.id, owner.userId, status+validity.expiresAt

**Data Validation & Type Safety**:
- Zod for schema validation and runtime type checking
- TypeScript for compile-time type safety

**Key Environment Variables Required**:
- `API_KEY` - Secret key for API authentication (required)
- `MONGODB_URI` - MongoDB connection string (required)
- `NODE_ENV` - Environment mode (development/production)
- `TRUST_PROXY` - Set to `true` if behind a reverse proxy for accurate IP logging (optional)

## API Usage Examples

### From Discord Bot
```javascript
// Verify license on bot startup (automatically adds guild to license)
const response = await fetch('https://your-api/api/verify-license', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.API_KEY
  },
  body: JSON.stringify({
    licenseKey: 'LM-2F7A9C-D3E8F1-H5K2L0',
    discordServerId: guild.id
  })
});

const { valid } = await response.json();
if (!valid) process.exit(1);

// When bot shuts down, remove guild from license
process.on('SIGINT', async () => {
  await fetch('https://your-api/api/licenses/LM-2F7A9C-D3E8F1-H5K2L0/deactivate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.API_KEY
    },
    body: JSON.stringify({ discordServerId: guild.id })
  });
  process.exit(0);
});
```

### License Management
```javascript
// Create comprehensive license
await fetch('https://your-api/api/licenses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.API_KEY
  },
  body: JSON.stringify({
    licenseKey: 'LM-2F7A9C-D3E8F1-H5K2L0',
    product: {
      name: 'Crim Tickets',
      id: 'prod_001'
    },
    owner: {
      userId: 'usr_12345',
      email: 'client@example.com'
    },
    validity: {
      issuedAt: '2025-11-10T00:00:00Z',
      expiresAt: 'never',
      durationDays: 'lifetime'
    },
    status: 'active',
    activation: {
      maxGuilds: 1,
      activeGuilds: []
    },
    metadata: {
      notes: 'Client: Shrreyan, Crim Tickets',
      reseller: 'BuiltByBit'
    },
    verification: {
      lastVerified: '2025-11-10T18:31:00Z',
      checksum: 'c42aebf0e5195c8b930a1b1e1ab9d7f8'
    }
  })
});

// Update license status
await fetch('https://your-api/api/licenses/LM-2F7A9C-D3E8F1-H5K2L0', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.API_KEY
  },
  body: JSON.stringify({ status: 'inactive' })
});
```

### Analytics
```javascript
// Get verification logs for a specific license
const response = await fetch('https://your-api/api/analytics/logs?licenseKey=LM-2F7A9C-D3E8F1-H5K2L0&limit=50', {
  headers: { 'X-API-Key': process.env.API_KEY }
});

const { logs } = await response.json();
```

## Security Considerations

- All management endpoints require API key authentication
- Guild activation limits strictly enforced
- Rate limiting prevents abuse (100 req/min per IP)
- Verification attempts are logged for audit trails
- Trust proxy is disabled by default - must be explicitly enabled for deployments behind reverse proxies

## Future Enhancements

- Implement license usage quotas and feature flags
- Add email notifications for license events
- Create admin dashboard for license management
- Implement license transfer functionality
- Add automatic guild cleanup via heartbeat/TTL for stale entries
- Implement device-specific tracking within guilds (store device IDs in array)
