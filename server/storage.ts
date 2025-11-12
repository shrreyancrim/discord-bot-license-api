import { type License, type CreateLicense, type UpdateLicense, type VerificationLog } from "@shared/schema";
import { MongoClient, Db, Collection } from "mongodb";

export interface IStorage {
  getLicenseByKey(licenseKey: string): Promise<License | null>;
  createLicense(license: CreateLicense): Promise<License>;
  updateLicense(licenseKey: string, updates: UpdateLicense): Promise<License | null>;
  deleteLicense(licenseKey: string): Promise<boolean>;
  getAllLicenses(): Promise<License[]>;
  logVerification(log: VerificationLog): Promise<void>;
  getVerificationLogs(licenseKey?: string, limit?: number): Promise<VerificationLog[]>;
  addActiveGuild(licenseKey: string, guildId: string): Promise<License | null>;
  removeActiveGuild(licenseKey: string, guildId: string): Promise<License | null>;
  connect(): Promise<void>;
}

export class MongoStorage implements IStorage {
  private client: MongoClient;
  private db: Db | null = null;
  private licenses: Collection<License> | null = null;
  private verificationLogs: Collection<VerificationLog> | null = null;

  constructor(uri: string) {
    this.client = new MongoClient(uri);
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.db = this.client.db();
      this.licenses = this.db.collection<License>("licenses");
      this.verificationLogs = this.db.collection<VerificationLog>("verification_logs");
      
      await this.licenses.createIndex({ licenseKey: 1 }, { unique: true });
      await this.licenses.createIndex({ "product.id": 1 });
      await this.licenses.createIndex({ "owner.discordId": 1 });
      await this.licenses.createIndex({ status: 1, "validity.expiresAt": 1 });
      await this.verificationLogs.createIndex({ licenseKey: 1 });
      await this.verificationLogs.createIndex({ timestamp: -1 });
      
      console.log("Successfully connected to MongoDB");
    } catch (error) {
      console.error("Failed to connect to MongoDB:", error);
      throw error;
    }
  }

  async getLicenseByKey(licenseKey: string): Promise<License | null> {
    if (!this.licenses) {
      throw new Error("Database not connected");
    }

    try {
      const license = await this.licenses.findOne({ licenseKey });
      return license;
    } catch (error) {
      console.error("Error fetching license:", error);
      throw error;
    }
  }

  async createLicense(license: CreateLicense): Promise<License> {
    if (!this.licenses) {
      throw new Error("Database not connected");
    }

    try {
      const newLicense: License = {
        ...license,
        metadata: {
          notes: license.metadata?.notes || "",
          reseller: license.metadata?.reseller || "",
        },
      };

      await this.licenses.insertOne(newLicense as any);
      return newLicense;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new Error("License key already exists");
      }
      console.error("Error creating license:", error);
      throw error;
    }
  }

  async updateLicense(licenseKey: string, updates: UpdateLicense): Promise<License | null> {
    if (!this.licenses) {
      throw new Error("Database not connected");
    }

    try {
      const updateDoc: any = {};
      
      if (updates.product) {
        Object.entries(updates.product).forEach(([key, value]) => {
          if (value !== undefined) {
            updateDoc[`product.${key}`] = value;
          }
        });
      }
      
      if (updates.owner) {
        Object.entries(updates.owner).forEach(([key, value]) => {
          if (value !== undefined) {
            updateDoc[`owner.${key}`] = value;
          }
        });
      }
      
      if (updates.validity) {
        Object.entries(updates.validity).forEach(([key, value]) => {
          if (value !== undefined) {
            updateDoc[`validity.${key}`] = value;
          }
        });
      }
      
      if (updates.activation) {
        Object.entries(updates.activation).forEach(([key, value]) => {
          if (value !== undefined) {
            updateDoc[`activation.${key}`] = value;
          }
        });
      }
      
      if (updates.metadata) {
        Object.entries(updates.metadata).forEach(([key, value]) => {
          if (value !== undefined) {
            updateDoc[`metadata.${key}`] = value;
          }
        });
      }
      
      if (updates.security) {
        Object.entries(updates.security).forEach(([key, value]) => {
          if (value !== undefined) {
            updateDoc[`security.${key}`] = value;
          }
        });
      }
      
      if (updates.status !== undefined) {
        updateDoc.status = updates.status;
      }
      
      if (updates.lastChecked !== undefined) {
        updateDoc.lastChecked = updates.lastChecked;
      }

      if (Object.keys(updateDoc).length === 0) {
        return await this.getLicenseByKey(licenseKey);
      }

      const result = await this.licenses.findOneAndUpdate(
        { licenseKey },
        { $set: updateDoc },
        { returnDocument: "after" }
      );

      return result || null;
    } catch (error) {
      console.error("Error updating license:", error);
      throw error;
    }
  }

  async addActiveGuild(licenseKey: string, guildId: string): Promise<License | null> {
    if (!this.licenses) {
      throw new Error("Database not connected");
    }

    try {
      const result = await this.licenses.findOneAndUpdate(
        { 
          licenseKey,
          $expr: {
            $or: [
              { $in: [guildId, "$activation.allowedGuilds"] },
              { $lt: [{ $size: "$activation.allowedGuilds" }, "$activation.maxGuilds"] }
            ]
          }
        },
        { 
          $addToSet: { "activation.allowedGuilds": guildId },
          $inc: { "activation.activatedGuilds": 0 }
        },
        { returnDocument: "after" }
      );

      return result || null;
    } catch (error) {
      console.error("Error adding active guild:", error);
      throw error;
    }
  }

  async removeActiveGuild(licenseKey: string, guildId: string): Promise<License | null> {
    if (!this.licenses) {
      throw new Error("Database not connected");
    }

    try {
      const result = await this.licenses.findOneAndUpdate(
        { licenseKey },
        { $pull: { "activation.allowedGuilds": guildId } },
        { returnDocument: "after" }
      );

      return result || null;
    } catch (error) {
      console.error("Error removing active guild:", error);
      throw error;
    }
  }

  async deleteLicense(licenseKey: string): Promise<boolean> {
    if (!this.licenses) {
      throw new Error("Database not connected");
    }

    try {
      const result = await this.licenses.deleteOne({ licenseKey });
      return result.deletedCount > 0;
    } catch (error) {
      console.error("Error deleting license:", error);
      throw error;
    }
  }

  async getAllLicenses(): Promise<License[]> {
    if (!this.licenses) {
      throw new Error("Database not connected");
    }

    try {
      const licenses = await this.licenses.find({}).toArray();
      return licenses;
    } catch (error) {
      console.error("Error fetching all licenses:", error);
      throw error;
    }
  }

  async logVerification(log: VerificationLog): Promise<void> {
    if (!this.verificationLogs) {
      throw new Error("Database not connected");
    }

    try {
      await this.verificationLogs.insertOne(log as any);
    } catch (error) {
      console.error("Error logging verification:", error);
    }
  }

  async getVerificationLogs(licenseKey?: string, limit: number = 100): Promise<VerificationLog[]> {
    if (!this.verificationLogs) {
      throw new Error("Database not connected");
    }

    try {
      const query = licenseKey ? { licenseKey } : {};
      const logs = await this.verificationLogs
        .find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
      return logs;
    } catch (error) {
      console.error("Error fetching verification logs:", error);
      throw error;
    }
  }
}

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  throw new Error("MONGODB_URI environment variable is not set");
}

export const storage = new MongoStorage(mongoUri);
