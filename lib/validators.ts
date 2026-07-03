import { z } from "zod";
import { isValidRut } from "./rut";

const rutSchema = z
  .string()
  .min(1, "RUT requerido")
  .refine((val) => isValidRut(val), "RUT inválido");

export const createCustomerSchema = z.object({
  rut: rutSchema,
  name: z.string().min(2, "Nombre requerido").max(120),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z
    .string()
    .min(8, "Teléfono requerido (mejor llave de deduplicación en GHL)")
    .max(20),
});

export const createSaleSchema = z.object({
  customerId: z.string().cuid("ID de cliente inválido"),
});

export const redeemSchema = z.object({
  customerId: z.string().cuid("ID de cliente inválido"),
});

export const createUserSchema = z
  .object({
    email: z.string().email("Email inválido"),
    name: z.string().min(2, "Nombre requerido").max(120),
    password: z.string().min(8, "Mínimo 8 caracteres").optional(),
    role: z.enum(["MANAGER", "CASHIER"]),
    sendInvite: z.boolean().default(true),
  })
  .refine((data) => data.sendInvite || Boolean(data.password), {
    message: "Contraseña requerida si no envías invitación por correo",
    path: ["password"],
  });

export const updateUserSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email("Email inválido").optional(),
  role: z.enum(["MANAGER", "CASHIER"]).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token requerido"),
  newPassword: z.string().min(8, "Mínimo 8 caracteres"),
});

export const activateAccountSchema = z.object({
  token: z.string().min(1, "Token requerido"),
  newPassword: z.string().min(8, "Mínimo 8 caracteres"),
});

export const statusPatchSchema = z.object({
  isActive: z.boolean(),
});

export const updateBusinessSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  logoUrl: z.string().url().optional().nullable().or(z.literal("")),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido")
    .optional(),
  rewardAt: z.number().int().min(2).max(50).optional(),
  ghlPurchaseWebhookUrl: z.string().url().optional().nullable().or(z.literal("")),
  ghlRedeemWebhookUrl: z.string().url().optional().nullable().or(z.literal("")),
});

export const createBusinessSchema = z.object({
  name: z.string().min(2, "Nombre requerido").max(120),
  slug: z
    .string()
    .min(2, "Slug requerido")
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug: solo minúsculas, números y guiones"),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido")
    .optional(),
  rewardAt: z.coerce.number().int().min(2).max(50).optional(),
  ghlPurchaseWebhookUrl: z.string().url("URL de webhook inválida"),
  ghlRedeemWebhookUrl: z.string().url("URL de canje inválida").optional().or(z.literal("")),
  managerEmail: z.string().email("Email del manager inválido"),
  managerName: z.string().min(2, "Nombre del manager requerido").max(120),
  managerPassword: z.string().min(8, "Mínimo 8 caracteres").optional(),
  sendInvite: z.boolean().default(true),
}).refine((data) => data.sendInvite || Boolean(data.managerPassword), {
  message: "Contraseña del manager requerida si no envías invitación",
  path: ["managerPassword"],
});

export const updateBusinessAdminSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido")
    .optional(),
  rewardAt: z.coerce.number().int().min(2).max(50).optional(),
  ghlPurchaseWebhookUrl: z.string().url("URL de webhook inválida").optional(),
  ghlRedeemWebhookUrl: z.string().url("URL de canje inválida").optional().nullable().or(z.literal("")),
});

export const listQuerySchema = z.object({
  status: z.enum(["active", "inactive", "all"]).default("all"),
  query: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const customerSearchSchema = z.object({
  rut: rutSchema,
});

export const adminResetPasswordSchema = z.object({
  password: z.string().min(8, "Mínimo 8 caracteres").optional(),
});

export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Contraseña actual requerida"),
  newPassword: z.string().min(8, "Mínimo 8 caracteres"),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
