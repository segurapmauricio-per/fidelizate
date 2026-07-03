import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function main() {
  const ghlWebhook = process.env.GHL_DEMO_WEBHOOK_URL || null;
  const ghlRedeemWebhook = process.env.GHL_DEMO_REDEEM_WEBHOOK_URL || null;

  await prisma.sale.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.business.deleteMany();

  // Negocio "plataforma": hogar del super-admin (no es un negocio operativo).
  const platform = await prisma.business.create({
    data: { name: "Plataforma", slug: "platform", rewardAt: 10 },
  });

  const verifiedAt = new Date();

  await prisma.user.create({
    data: {
      email: "admin@fidelizate.cl",
      name: "Super Admin",
      passwordHash: await hash("Admin2026!", BCRYPT_ROUNDS),
      role: "SUPER_ADMIN",
      businessId: platform.id,
      emailVerified: verifiedAt,
    },
  });

  const business = await prisma.business.create({
    data: {
      name: "Negocio Demo",
      slug: "demo",
      rewardAt: 10,
      primaryColor: "#e63946",
      ghlPurchaseWebhookUrl: ghlWebhook,
      ghlRedeemWebhookUrl: ghlRedeemWebhook,
    },
  });

  await prisma.user.createMany({
    data: [
      {
        email: "manager@demo.cl",
        name: "Manager Demo",
        passwordHash: await hash("Fidelizate2026!", BCRYPT_ROUNDS),
        role: "MANAGER",
        businessId: business.id,
        emailVerified: verifiedAt,
      },
      {
        email: "cajero@demo.cl",
        name: "Cajero Demo",
        passwordHash: await hash("Caja2026!", BCRYPT_ROUNDS),
        role: "CASHIER",
        businessId: business.id,
        emailVerified: verifiedAt,
      },
    ],
  });

  await prisma.customer.createMany({
    data: [
      {
        businessId: business.id,
        rut: "123456785",
        name: "Juan Pérez",
        email: "juan@correo.cl",
        phone: "+56912345678",
        stampCount: 2,
        totalStamps: 2,
      },
      {
        businessId: business.id,
        rut: "111111111",
        name: "María González",
        email: "maria@correo.cl",
        phone: "+56987654321",
        stampCount: 5,
        totalStamps: 5,
      },
      {
        businessId: business.id,
        rut: "187654325",
        name: "Pedro Soto",
        email: "pedro@correo.cl",
        phone: "+56911223344",
        stampCount: 9,
        totalStamps: 9,
      },
    ],
  });

  console.log("Seed completado:");
  console.log("  Super Admin: admin@fidelizate.cl / Admin2026!");
  console.log("  Manager: manager@demo.cl / Fidelizate2026!");
  console.log("  Cajero:  cajero@demo.cl / Caja2026!");
  if (ghlWebhook) console.log("  GHL webhook configurado desde GHL_DEMO_WEBHOOK_URL");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
