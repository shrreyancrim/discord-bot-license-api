import { z } from "zod";

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  id: z.string().min(1, "Product ID is required"),
});

const ownerSchema = z.object({
  discordId: z.string().min(1, "Discord ID is required"),
  username: z.string().min(1, "Username is required"),
});

const validitySchema = z.object({
  issuedAt: z.string().transform((val) => new Date(val)),
  expiresAt: z.string().nullable().transform((val) => val ? new Date(val) : null),
  lifetime: z.boolean(),
});

const activationSchema = z.object({
  maxGuilds: z.number().int().positive(),
  activatedGuilds: z.number().int().nonnegative().default(0),
  allowedGuilds: z.array(z.string()).default([]),
});

const metadataSchema = z.object({
  reseller: z.string().default(""),
  notes: z.string().default(""),
});

const securitySchema = z.object({
  readOnly: z.boolean().default(true),
  checksum: z.string(),
});

const validityUpdateSchema = z.object({
  issuedAt: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  expiresAt: z.string().nullable().optional().transform((val) => val ? new Date(val) : null),
  lifetime: z.boolean().optional(),
});

const securityUpdateSchema = z.object({
  readOnly: z.boolean().optional(),
  checksum: z.string().optional(),
});

export const licenseSchema = z.object({
  _id: z.string().optional(),
  licenseKey: z.string().min(1, "License key is required"),
  product: productSchema,
  owner: ownerSchema,
  validity: validitySchema,
  status: z.enum(["active", "inactive"]).default("active"),
  activation: activationSchema,
  metadata: metadataSchema,
  security: securitySchema,
  lastChecked: z.string().transform((val) => new Date(val)),
});

export const createLicenseSchema = z.object({
  licenseKey: z.string().min(1, "License key is required"),
  product: productSchema,
  owner: ownerSchema,
  validity: validitySchema,
  status: z.enum(["active", "inactive"]).default("active"),
  activation: activationSchema,
  metadata: metadataSchema.partial().default({}),
  security: securitySchema,
  lastChecked: z.string().transform((val) => new Date(val)),
});

export const updateLicenseSchema = z.object({
  product: productSchema.partial().optional(),
  owner: ownerSchema.partial().optional(),
  validity: validityUpdateSchema.partial().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  activation: activationSchema.partial().optional(),
  metadata: metadataSchema.partial().optional(),
  security: securityUpdateSchema.partial().optional(),
  lastChecked: z.string().optional().transform((val) => val ? new Date(val) : undefined),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" }
);

export const verifyLicenseRequestSchema = z.object({
  licenseKey: z.string().min(1, "License key is required"),
  discordServerId: z.string().min(1, "Discord server ID is required"),
  deviceId: z.string().optional(),
});

export const verificationLogSchema = z.object({
  licenseKey: z.string(),
  discordServerId: z.string().optional(),
  deviceId: z.string().optional(),
  success: z.boolean(),
  reason: z.string().optional(),
  timestamp: z.date().default(() => new Date()),
  ipAddress: z.string().optional(),
});

export type License = z.infer<typeof licenseSchema>;
export type CreateLicense = z.infer<typeof createLicenseSchema>;
export type UpdateLicense = z.infer<typeof updateLicenseSchema>;
export type VerifyLicenseRequest = z.infer<typeof verifyLicenseRequestSchema>;
export type VerificationLog = z.infer<typeof verificationLogSchema>;
