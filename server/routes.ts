import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import rateLimit from "express-rate-limit";
import { verifyLicenseRequestSchema, createLicenseSchema, updateLicenseSchema } from "@shared/schema";

const apiKeyMiddleware = (req: any, res: any, next: any) => {
  const apiKey = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
  
  if (!apiKey) {
    return res.status(401).json({ 
      valid: false,
      error: "Missing API key. Provide via X-API-Key header or Authorization Bearer token" 
    });
  }

  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ 
      valid: false,
      error: "Invalid API key" 
    });
  }

  next();
};

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { 
    valid: false,
    error: "Too many requests, please try again later" 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export async function registerRoutes(app: Express): Promise<Server> {
  await storage.connect();

  app.post("/api/verify-license", limiter, apiKeyMiddleware, async (req, res) => {
    try {
      const validation = verifyLicenseRequestSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          valid: false,
          error: "Invalid request format",
          details: validation.error.errors,
        });
      }

      const { licenseKey, discordServerId, deviceId } = validation.data;

      const license = await storage.getLicenseByKey(licenseKey);

      const logEntry = {
        licenseKey,
        discordServerId,
        deviceId,
        success: false,
        reason: "",
        timestamp: new Date(),
        ipAddress: req.ip,
      };

      if (!license) {
        logEntry.reason = "License not found";
        await storage.logVerification(logEntry);
        return res.json({
          valid: false,
          message: "License not found",
        });
      }

      if (license.status !== "active") {
        logEntry.reason = "License is inactive";
        await storage.logVerification(logEntry);
        return res.json({
          valid: false,
          message: "License is inactive",
        });
      }

      if (!license.validity.lifetime && license.validity.expiresAt) {
        const expiryDate = new Date(license.validity.expiresAt);
        if (expiryDate < new Date()) {
          logEntry.reason = "License has expired";
          await storage.logVerification(logEntry);
          return res.json({
            valid: false,
            message: "License has expired",
            expiresAt: license.validity.expiresAt,
          });
        }
      }

      const isGuildActive = license.activation.allowedGuilds.includes(discordServerId);
      
      const updatedLicense = await storage.addActiveGuild(licenseKey, discordServerId);
      
      if (!updatedLicense) {
        logEntry.reason = "Maximum guilds reached";
        await storage.logVerification(logEntry);
        return res.json({
          valid: false,
          message: "Maximum number of guilds reached for this license",
          maxGuilds: license.activation.maxGuilds,
          activeGuilds: license.activation.allowedGuilds.length,
        });
      }

      const updatePayload = updateLicenseSchema.parse({
        lastChecked: new Date().toISOString(),
      });
      
      await storage.updateLicense(licenseKey, updatePayload);

      logEntry.success = true;
      logEntry.reason = "Valid license";
      await storage.logVerification(logEntry);

      const finalLicense = await storage.getLicenseByKey(licenseKey);

      return res.json({
        valid: true,
        message: isGuildActive ? "License is valid (guild already active)" : "License is valid (guild activated)",
        license: {
          licenseKey: finalLicense!.licenseKey,
          product: finalLicense!.product,
          owner: finalLicense!.owner,
          status: finalLicense!.status,
          validity: finalLicense!.validity,
          activation: finalLicense!.activation,
        },
      });

    } catch (error) {
      console.error("Error verifying license:", error);
      return res.status(500).json({
        valid: false,
        error: "Internal server error",
      });
    }
  });

  app.post("/api/licenses", limiter, apiKeyMiddleware, async (req, res) => {
    try {
      const validation = createLicenseSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid request format",
          details: validation.error.errors,
        });
      }

      const license = await storage.createLicense(validation.data);

      return res.status(201).json({
        message: "License created successfully",
        license,
      });

    } catch (error: any) {
      if (error.message === "License key already exists") {
        return res.status(409).json({
          error: "License key already exists",
        });
      }
      console.error("Error creating license:", error);
      return res.status(500).json({
        error: "Internal server error",
      });
    }
  });

  app.get("/api/licenses", limiter, apiKeyMiddleware, async (req, res) => {
    try {
      const licenses = await storage.getAllLicenses();

      return res.json({
        licenses,
        count: licenses.length,
      });

    } catch (error) {
      console.error("Error fetching licenses:", error);
      return res.status(500).json({
        error: "Internal server error",
      });
    }
  });

  app.get("/api/licenses/:licenseKey", limiter, apiKeyMiddleware, async (req, res) => {
    try {
      const { licenseKey } = req.params;
      const license = await storage.getLicenseByKey(licenseKey);

      if (!license) {
        return res.status(404).json({
          error: "License not found",
        });
      }

      return res.json({ license });

    } catch (error) {
      console.error("Error fetching license:", error);
      return res.status(500).json({
        error: "Internal server error",
      });
    }
  });

  app.put("/api/licenses/:licenseKey", limiter, apiKeyMiddleware, async (req, res) => {
    try {
      const { licenseKey } = req.params;
      const validation = updateLicenseSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid request format",
          details: validation.error.errors,
        });
      }

      const license = await storage.updateLicense(licenseKey, validation.data);

      if (!license) {
        return res.status(404).json({
          error: "License not found",
        });
      }

      return res.json({
        message: "License updated successfully",
        license,
      });

    } catch (error) {
      console.error("Error updating license:", error);
      return res.status(500).json({
        error: "Internal server error",
      });
    }
  });

  app.post("/api/licenses/:licenseKey/deactivate", limiter, apiKeyMiddleware, async (req, res) => {
    try {
      const { licenseKey } = req.params;
      const { discordServerId } = req.body;

      if (!discordServerId) {
        return res.status(400).json({
          error: "Discord server ID is required",
        });
      }

      const license = await storage.getLicenseByKey(licenseKey);

      if (!license) {
        return res.status(404).json({
          error: "License not found",
        });
      }

      if (!license.activation.allowedGuilds.includes(discordServerId)) {
        return res.status(400).json({
          error: "Guild is not active for this license",
          allowedGuilds: license.activation.allowedGuilds,
        });
      }

      const updatedLicense = await storage.removeActiveGuild(licenseKey, discordServerId);

      return res.json({
        message: "Guild deactivated successfully",
        license: updatedLicense,
      });

    } catch (error) {
      console.error("Error deactivating guild:", error);
      return res.status(500).json({
        error: "Internal server error",
      });
    }
  });

  app.delete("/api/licenses/:licenseKey", limiter, apiKeyMiddleware, async (req, res) => {
    try {
      const { licenseKey } = req.params;
      const deleted = await storage.deleteLicense(licenseKey);

      if (!deleted) {
        return res.status(404).json({
          error: "License not found",
        });
      }

      return res.json({
        message: "License deleted successfully",
      });

    } catch (error) {
      console.error("Error deleting license:", error);
      return res.status(500).json({
        error: "Internal server error",
      });
    }
  });

  app.get("/api/analytics/logs", limiter, apiKeyMiddleware, async (req, res) => {
    try {
      const { licenseKey, limit } = req.query;
      const logs = await storage.getVerificationLogs(
        licenseKey as string | undefined,
        limit ? parseInt(limit as string) : 100
      );

      return res.json({
        logs,
        count: logs.length,
      });

    } catch (error) {
      console.error("Error fetching logs:", error);
      return res.status(500).json({
        error: "Internal server error",
      });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const httpServer = createServer(app);

  return httpServer;
}
