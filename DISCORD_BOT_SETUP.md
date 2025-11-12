a# Discord Bot License Verification Setup

This guide shows you how to integrate license verification into your Discord bot using the guild-based activation system.

## 🔴 Important: Instant License Suspension

**When you suspend a license (change status to "inactive"), the bot will automatically shut down within 5 seconds.**

The bot continuously checks the license status every 5 seconds. This means:
- ✅ **Immediate control**: Suspending a license causes instant shutdown
- ✅ **Real-time monitoring**: No need to manually stop bots
- ✅ **Automatic enforcement**: Bots respect license status in real-time

## Prerequisites

- Your Discord bot code (using discord.js or similar)
- Node.js installed (version 18+ recommended for built-in fetch)
- The license verification API running and published

## Installation

If using Node.js version below 18, install node-fetch:

```bash
npm install node-fetch dotenv
```

For Node.js 18+, fetch is built-in. You only need:

```bash
npm install dotenv
```

## Basic Integration

Add this code to your Discord bot's main file where the bot starts up:

### JavaScript Example

```javascript
const { Client, GatewayIntentBits } = require('discord.js');
// Only needed for Node.js < 18:
// const fetch = require('node-fetch');

require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// License verification function
async function verifyLicense(licenseKey, guildId) {
  try {
    const response = await fetch(`${process.env.LICENSE_API_URL}/api/verify-license`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.LICENSE_API_KEY
      },
      body: JSON.stringify({
        licenseKey: licenseKey,
        discordServerId: guildId
      })
    });

    const data = await response.json();
    
    if (data.valid) {
      console.log('✅ License verified successfully');
      console.log(`   Product: ${data.license.product.name}`);
      console.log(`   Status: ${data.license.status}`);
      
      if (data.license.validity.expiresAt !== 'never') {
        console.log(`   Expires: ${new Date(data.license.validity.expiresAt).toLocaleDateString()}`);
      } else {
        console.log('   Expires: Never (Lifetime)');
      }
      
      console.log(`   Active Guilds: ${data.license.activation.activeGuilds.length}/${data.license.activation.maxGuilds}`);
      return true;
    } else {
      console.error(`❌ License verification failed: ${data.message}`);
      if (data.maxGuilds) {
        console.error(`   Max guilds: ${data.maxGuilds}, Active: ${data.activeGuilds}`);
      }
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error verifying license:', error.message);
    return false;
  }
}

// Deactivate guild when bot shuts down
async function deactivateLicense(licenseKey, guildId) {
  try {
    const response = await fetch(`${process.env.LICENSE_API_URL}/api/licenses/${licenseKey}/deactivate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.LICENSE_API_KEY
      },
      body: JSON.stringify({
        discordServerId: guildId
      })
    });

    const data = await response.json();
    console.log('Guild deactivated:', data.message);
  } catch (error) {
    console.error('Error deactivating license:', error.message);
  }
}

// CRITICAL: Automatic license monitoring for instant suspension detection
// Checks every 5 seconds to ensure the license is still valid
let licenseCheckInterval;

// Verify license when bot starts
client.once('ready', async () => {
  console.log('Bot starting... verifying license');
  
  const guildId = client.guilds.cache.first()?.id || process.env.DISCORD_SERVER_ID;
  
  if (!guildId) {
    console.error('No guild ID found. Bot must be in at least one server.');
    process.exit(1);
  }
  
  const isValid = await verifyLicense(process.env.LICENSE_KEY, guildId);
  
  if (!isValid) {
    console.error('License verification failed. Shutting down...');
    process.exit(1);
  }
  
  console.log(`Bot is ready! Logged in as ${client.user.tag}`);
  console.log('🔍 License monitoring active - checking every 5 seconds');
  
  // IMPORTANT: Check license every 5 seconds for instant suspension detection
  // When license status changes to "inactive", bot shuts down within 5 seconds
  licenseCheckInterval = setInterval(async () => {
    const currentGuildId = client.guilds.cache.first()?.id || process.env.DISCORD_SERVER_ID;
    
    if (!currentGuildId) {
      console.error('Guild ID lost. Shutting down...');
      clearInterval(licenseCheckInterval);
      process.exit(1);
      return;
    }
    
    const stillValid = await verifyLicense(process.env.LICENSE_KEY, currentGuildId);
    
    if (!stillValid) {
      console.error('⚠️ License has been suspended or is no longer valid!');
      console.error('Shutting down immediately...');
      clearInterval(licenseCheckInterval);
      await deactivateLicense(process.env.LICENSE_KEY, currentGuildId);
      process.exit(1);
    }
  }, 5000); // Check every 5 seconds
});

// Graceful shutdown - deactivate guild when bot stops
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  
  if (licenseCheckInterval) {
    clearInterval(licenseCheckInterval);
  }
  
  const guildId = client.guilds.cache.first()?.id || process.env.DISCORD_SERVER_ID;
  
  if (guildId) {
    await deactivateLicense(process.env.LICENSE_KEY, guildId);
  }
  
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
```

### TypeScript Example

```typescript
import { Client, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

interface LicenseResponse {
  valid: boolean;
  message: string;
  license?: {
    licenseKey: string;
    product: {
      name: string;
      id: string;
    };
    owner: {
      discordId: string;
      username: string;
    };
    status: 'active' | 'inactive';
    validity: {
      issuedAt: string;
      expiresAt: string | null;
      lifetime: boolean;
    };
    activation: {
      maxGuilds: number;
      activatedGuilds: number;
      allowedGuilds: string[];
    };
  };
  maxGuilds?: number;
  activeGuilds?: number;
}

async function verifyLicense(
  licenseKey: string, 
  guildId: string
): Promise<boolean> {
  try {
    const response = await fetch(`${process.env.LICENSE_API_URL}/api/verify-license`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.LICENSE_API_KEY!
      },
      body: JSON.stringify({
        licenseKey,
        discordServerId: guildId
      })
    });

    const data: LicenseResponse = await response.json();
    
    if (data.valid && data.license) {
      console.log('✅ License verified successfully');
      console.log(`   Product: ${data.license.product.name}`);
      console.log(`   Status: ${data.license.status}`);
      
      if (data.license.validity.expiresAt !== 'never') {
        console.log(`   Expires: ${new Date(data.license.validity.expiresAt).toLocaleDateString()}`);
      } else {
        console.log('   Expires: Never (Lifetime)');
      }
      
      console.log(`   Active Guilds: ${data.license.activation.activeGuilds.length}/${data.license.activation.maxGuilds}`);
      return true;
    } else {
      console.error(`❌ License verification failed: ${data.message}`);
      if (data.maxGuilds) {
        console.error(`   Max guilds: ${data.maxGuilds}, Active: ${data.activeGuilds}`);
      }
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error verifying license:', error);
    return false;
  }
}

async function deactivateLicense(licenseKey: string, guildId: string): Promise<void> {
  try {
    const response = await fetch(`${process.env.LICENSE_API_URL}/api/licenses/${licenseKey}/deactivate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.LICENSE_API_KEY!
      },
      body: JSON.stringify({
        discordServerId: guildId
      })
    });

    const data = await response.json();
    console.log('Guild deactivated:', data.message);
  } catch (error) {
    console.error('Error deactivating license:', error);
  }
}

// CRITICAL: Automatic license monitoring for instant suspension detection
let licenseCheckInterval: NodeJS.Timeout;

client.once('ready', async () => {
  console.log('Bot starting... verifying license');
  
  const guildId = client.guilds.cache.first()?.id || process.env.DISCORD_SERVER_ID!;
  
  if (!guildId) {
    console.error('No guild ID found. Bot must be in at least one server.');
    process.exit(1);
  }
  
  const isValid = await verifyLicense(process.env.LICENSE_KEY!, guildId);
  
  if (!isValid) {
    console.error('License verification failed. Shutting down...');
    process.exit(1);
  }
  
  console.log(`Bot is ready! Logged in as ${client.user.tag}`);
  console.log('🔍 License monitoring active - checking every 5 seconds');
  
  // IMPORTANT: Check license every 5 seconds for instant suspension detection
  // When license status changes to "inactive", bot shuts down within 5 seconds
  licenseCheckInterval = setInterval(async () => {
    const currentGuildId = client.guilds.cache.first()?.id || process.env.DISCORD_SERVER_ID!;
    
    if (!currentGuildId) {
      console.error('Guild ID lost. Shutting down...');
      clearInterval(licenseCheckInterval);
      process.exit(1);
      return;
    }
    
    const stillValid = await verifyLicense(process.env.LICENSE_KEY!, currentGuildId);
    
    if (!stillValid) {
      console.error('⚠️ License has been suspended or is no longer valid!');
      console.error('Shutting down immediately...');
      clearInterval(licenseCheckInterval);
      await deactivateLicense(process.env.LICENSE_KEY!, currentGuildId);
      process.exit(1);
    }
  }, 5000); // Check every 5 seconds
});

process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  
  if (licenseCheckInterval) {
    clearInterval(licenseCheckInterval);
  }
  
  const guildId = client.guilds.cache.first()?.id || process.env.DISCORD_SERVER_ID!;
  
  if (guildId) {
    await deactivateLicense(process.env.LICENSE_KEY!, guildId);
  }
  
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
```

## Environment Variables Setup

Create a `.env` file in your bot's project directory:

```env
# Discord Bot Token
DISCORD_TOKEN=your_discord_bot_token

# License Configuration (provided by your bot developer)
LICENSE_KEY=LM-XXXXX-XXXXX-XXXXX
LICENSE_API_URL=https://your-app.replit.app
LICENSE_API_KEY=your-api-key-from-developer

# Optional: Fallback if bot can't detect guild ID automatically
DISCORD_SERVER_ID=123456789012345678
```

**Add this at the top of your bot file:**
```javascript
require('dotenv').config();
```

## Configuration Details

### Required Settings

1. **LICENSE_KEY**: The unique license key assigned to you (format: `LM-XXXXX-XXXXX-XXXXX`)
2. **LICENSE_API_URL**: The published API URL (e.g., `https://your-app.replit.app`)
   - **Important**: Do NOT include `/api/verify-license` at the end, just the base URL
3. **LICENSE_API_KEY**: The API authentication key (provided by your bot developer)
4. **DISCORD_TOKEN**: Your Discord bot token

### Optional Settings

5. **DISCORD_SERVER_ID**: Fallback guild ID if the bot can't detect it automatically
   - Usually not needed as the bot auto-detects the guild

## How Guild-Based Activation Works

### Multi-Guild Support
- Each license supports a specific number of guilds (servers) set by `maxGuilds`
- When your bot starts and verifies the license, the guild is **automatically added** to the license's active guilds list
- If you restart the bot, it verifies again but doesn't count as a new guild (already in the list)

### Guild Limits
- If your license allows 1 guild (`maxGuilds: 1`), the bot can only run in 1 server
- If your license allows 3 guilds (`maxGuilds: 3`), the bot can run in up to 3 servers simultaneously
- Once the limit is reached, verification will fail for new guilds

### Clean Shutdown
- When your bot shuts down gracefully (Ctrl+C), it should call the deactivation endpoint
- This removes the guild from the active list, freeing up a slot
- This allows you to move the bot to a different server without hitting the guild limit

## How to Get Discord Server ID

1. Enable Developer Mode in Discord:
   - User Settings → Advanced → Developer Mode (toggle on)
2. Right-click on your server icon
3. Click "Copy Server ID"

## License Verification Flow

```
Bot Starts in Guild
    ↓
Send verification request with guild ID
    ↓
API checks license in MongoDB
    ↓
┌─────────────────────────────────┐
│  License Valid & Under Limit?   │
├─────────────┬───────────────────┤
│     YES     │        NO         │
│             │                   │
│ Add guild   │  Return error:    │
│ to active   │  - Not found      │
│ guilds list │  - Inactive       │
│             │  - Expired        │
│ Bot starts  │  - Max guilds     │
│             │                   │
│             │  Bot shuts down   │
└─────────────┴───────────────────┘

Bot Shutdown (Ctrl+C)
    ↓
Send deactivation request
    ↓
Guild removed from active list
    ↓
Slot freed for future use
```

## API Response Examples

### Success Response
```json
{
  "valid": true,
  "message": "License is valid (guild activated)",
  "license": {
    "licenseKey": "LM-2F7A9C-D3E8F1-H5K2L0",
    "product": {
      "name": "My Discord Bot",
      "id": "prod_discord_bot"
    },
    "owner": {
      "discordId": "123456789012345678",
      "username": "CustomerUsername"
    },
    "status": "active",
    "validity": {
      "issuedAt": "2025-11-10T00:00:00.000Z",
      "expiresAt": null,
      "lifetime": true
    },
    "activation": {
      "maxGuilds": 1,
      "activatedGuilds": 0,
      "allowedGuilds": ["123456789012345678"]
    }
  }
}
```

### Failure Responses

**License not found:**
```json
{
  "valid": false,
  "message": "License not found"
}
```

**License inactive:**
```json
{
  "valid": false,
  "message": "License is inactive"
}
```

**License expired:**
```json
{
  "valid": false,
  "message": "License has expired",
  "expiresAt": "2024-12-31T23:59:59.000Z"
}
```

**Maximum guilds reached:**
```json
{
  "valid": false,
  "message": "Maximum number of guilds reached for this license",
  "maxGuilds": 1,
  "activeGuilds": 1
}
```

**Note on `allowedGuilds` vs `activeGuilds`:** The response uses `activeGuilds` for the count, but internally the license stores guild IDs in the `allowedGuilds` array.

## 🔴 CRITICAL: Automatic License Monitoring (Required)

**INSTANT SHUTDOWN ON SUSPENSION**: When you change a license `status` to `"inactive"` in the database, the bot will detect it within 5 seconds and shut down automatically.

### Why This is Required

- **Real-time enforcement**: Suspended licenses cause instant bot shutdown
- **No manual intervention**: You don't need to manually stop bots
- **Continuous verification**: License status is checked every 5 seconds
- **Automatic cleanup**: Bot deactivates its guild before shutting down

### How to Suspend a License

Simply update the license status via the API:

```bash
curl -X PATCH https://your-api.replit.app/api/licenses/LM-XXXXX-XXXXX-XXXXX \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"status": "inactive"}'
```

Within 5 seconds, the bot will:
1. Detect the status change
2. Log a suspension message
3. Deactivate the guild
4. Shut down immediately

### Implementation

The examples above already include this functionality. If you're implementing manually, add this code:

```javascript
// Check license every 5 seconds for real-time suspension detection
let licenseCheckInterval;

client.once('ready', async () => {
  console.log('Bot starting... verifying license');
  
  const guildId = client.guilds.cache.first()?.id || process.env.DISCORD_SERVER_ID;
  
  if (!guildId) {
    console.error('No guild ID found. Bot must be in at least one server.');
    process.exit(1);
  }
  
  const isValid = await verifyLicense(process.env.LICENSE_KEY, guildId);
  
  if (!isValid) {
    console.error('License verification failed. Shutting down...');
    process.exit(1);
  }
  
  console.log(`Bot is ready! Logged in as ${client.user.tag}`);
  
  // Start periodic license checking every 5 seconds
  licenseCheckInterval = setInterval(async () => {
    const currentGuildId = client.guilds.cache.first()?.id || process.env.DISCORD_SERVER_ID;
    
    if (!currentGuildId) {
      console.error('Guild ID lost. Shutting down...');
      clearInterval(licenseCheckInterval);
      process.exit(1);
      return;
    }
    
    const stillValid = await verifyLicense(process.env.LICENSE_KEY, currentGuildId);
    
    if (!stillValid) {
      console.error('⚠️ License has been suspended or is no longer valid!');
      console.error('Shutting down immediately...');
      clearInterval(licenseCheckInterval);
      await deactivateLicense(process.env.LICENSE_KEY, currentGuildId);
      process.exit(1);
    }
  }, 5000); // Check every 5 seconds
});

// Clean up interval on shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  
  if (licenseCheckInterval) {
    clearInterval(licenseCheckInterval);
  }
  
  const guildId = client.guilds.cache.first()?.id || process.env.DISCORD_SERVER_ID;
  
  if (guildId) {
    await deactivateLicense(process.env.LICENSE_KEY, guildId);
  }
  
  process.exit(0);
});
```

### How It Works

1. **Initial Verification**: On startup, the bot verifies the license once
2. **Continuous Monitoring**: Every 5 seconds, the bot re-checks the license status
3. **Instant Suspension Detection**: If you change the license `status` to `"inactive"`, the bot detects it within 5 seconds
4. **Automatic Shutdown**: Bot immediately shuts down upon detecting suspension
5. **Automatic Cleanup**: Bot removes itself from the `allowedGuilds` list before shutting down

### Why Every 5 Seconds?

- **Instant Control**: License suspensions take effect within 5 seconds maximum
- **Minimal Overhead**: Verification is a lightweight API call (~50ms)
- **Real-time Enforcement**: No manual intervention needed to stop bots
- **Activity Tracking**: The `lastChecked` timestamp updates every 5 seconds

### What Happens When You Suspend a License

1. You change license `status` from `"active"` to `"inactive"` via API
2. Within 5 seconds, the bot's next verification check fails
3. Bot logs: `⚠️ License has been suspended or is no longer valid!`
4. Bot calls deactivation endpoint to remove guild
5. Bot executes `process.exit(1)` and shuts down immediately

**Note**: The verification endpoint automatically updates the `lastChecked` timestamp each time it's called, so you can see exactly when a bot was last active.

## Troubleshooting

### Common Issues

**Error: fetch is not defined**
- Install node-fetch: `npm install node-fetch`
- Or upgrade to Node.js 18+

**Error: Missing API key**
- Make sure `LICENSE_API_KEY` is set in your `.env` file
- Verify the API key is correct (provided by your bot developer)

**Error: Connection refused**
- Check that the API URL is correct in `LICENSE_API_URL`
- Verify the API is published and running
- Make sure you're using the base URL without `/api/verify-license`

**License verification fails unexpectedly**
- Check that the license exists and is active
- Verify the license hasn't expired (unless it's set to "never")
- Check if you've reached the maximum guild limit (`maxGuilds`)
- View logs at: `GET https://your-api/api/analytics/logs?licenseKey=YOUR-KEY`

**"Maximum number of guilds reached"**
- Your license has a limit on how many servers (guilds) it can run in
- Deactivate the bot from other servers to free up slots
- Contact your bot developer to upgrade your license for more guilds

**Bot can't detect guild ID**
- Make sure your bot is added to at least one server before starting
- Set `DISCORD_SERVER_ID` in your `.env` file as a fallback
- Ensure your bot has the `Guilds` intent enabled

**"500 Internal Server Error" - Schema Mismatch (For Developers)**
- This error occurs when a license was created with an old schema before the current guild-based activation system
- **Symptom**: Error message in API logs: `TypeError: Cannot read properties of undefined (reading 'includes')` or similar
- **Common Causes**: 
  - License has old `activeGuilds` instead of new `allowedGuilds`
  - Missing `owner.discordId` or `owner.username` (old schema used `userId` and `email`)
  - Missing `validity.lifetime` field
  - Has `verification` object instead of `security` object
- **Solution**: Update the license to the new schema using the API:

```bash
curl -X PUT https://your-api.replit.app/api/licenses/YOUR-LICENSE-KEY \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "owner": {
      "discordId": "123456789012345678",
      "username": "CustomerUsername"
    },
    "validity": {
      "lifetime": true
    },
    "activation": {
      "maxGuilds": 1,
      "activatedGuilds": 0,
      "allowedGuilds": []
    },
    "security": {
      "readOnly": true,
      "checksum": "your-checksum-here"
    },
    "lastChecked": "2025-11-12T00:00:00Z"
  }'
```

After updating, the bot should verify successfully. All new licenses created with the current system will have the correct schema automatically.

## Security Best Practices

1. **Never hardcode** your license key or API key in your code
2. **Use environment variables** for all sensitive data
3. **Keep your .env file** in `.gitignore` to avoid committing secrets
4. **Don't share** your API key with others
5. **Implement graceful shutdown** to properly deactivate guilds
6. **Never expose** license verification responses to end users

## Understanding the License Structure

Your license contains comprehensive information:

- **Product**: What bot/product this license is for
  - `name`: Product name (e.g., "Crim Tickets")
  - `id`: Product identifier (e.g., "prod_crim_tickets")
- **Owner**: Your Discord account information
  - `discordId`: Your Discord user ID
  - `username`: Your Discord username
- **Validity**: License duration and expiration
  - `issuedAt`: When the license was created
  - `expiresAt`: When it expires (`null` for lifetime licenses)
  - `lifetime`: `true` for lifetime licenses, `false` for time-limited
- **Status**: `"active"` or `"inactive"`
- **Activation**: Guild/server limits
  - `maxGuilds`: Maximum number of servers allowed
  - `activatedGuilds`: Counter (currently not actively used)
  - `allowedGuilds`: Array of Discord server IDs where the bot can run
- **Security**: Protection and verification
  - `readOnly`: Whether the license can be modified
  - `checksum`: Security verification string
- **lastChecked**: Last time the license was verified

## Support

If you need help:
1. Check the logs in your Discord bot console
2. Contact your bot developer for license issues
3. Verify your license details with: `GET /api/licenses/YOUR-LICENSE-KEY` (requires API key)
4. Check verification logs: `GET /api/analytics/logs?licenseKey=YOUR-KEY` (requires API key)

---

## For Bot Developers: Creating Licenses

If you're the developer managing licenses, here's how to create them:

```bash
curl -X POST https://your-app.replit.app/api/licenses \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "licenseKey": "LM-XXXXX-XXXXX-XXXXX",
    "product": {
      "name": "My Discord Bot",
      "id": "prod_discord_bot"
    },
    "owner": {
      "discordId": "123456789012345678",
      "username": "CustomerUsername"
    },
    "validity": {
      "issuedAt": "2025-11-12T00:00:00Z",
      "expiresAt": null,
      "lifetime": true
    },
    "status": "active",
    "activation": {
      "maxGuilds": 1,
      "activatedGuilds": 0,
      "allowedGuilds": []
    },
    "metadata": {
      "reseller": "BuildByBit",
      "notes": "Customer: John Doe, Purchased on BuildByBit"
    },
    "security": {
      "readOnly": true,
      "checksum": "generated-checksum-here"
    },
    "lastChecked": "2025-11-12T00:00:00Z"
  }'
```

**For time-limited licenses**, set:
```json
"validity": {
  "issuedAt": "2025-11-12T00:00:00Z",
  "expiresAt": "2026-11-12T00:00:00Z",
  "lifetime": false
}
```

### Customer Instructions Template

When you give your bot to customers, provide them with:

```
🤖 Discord Bot License Setup

1. Create a .env file in your bot folder
2. Add these lines:

DISCORD_TOKEN=your_discord_bot_token
LICENSE_KEY=LM-XXXXX-XXXXX-XXXXX
LICENSE_API_URL=https://your-app.replit.app
LICENSE_API_KEY=provided-api-key

3. Install dependencies: npm install
4. Start the bot: node index.js

Your license supports X guild(s). The bot will automatically verify on startup.
To stop the bot cleanly, use Ctrl+C (this frees up the guild slot).

For support, contact: your-support-email@example.com
```
