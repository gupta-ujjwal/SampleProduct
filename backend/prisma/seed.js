import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const products = await Promise.all([
    prisma.product.upsert({
      where: { id: "prod-001" },
      update: {},
      create: {
        id: "prod-001",
        name: "Wireless Headphones",
        description: "Premium noise-cancelling wireless headphones with 30hr battery life",
        price: 2999.0,
        currency: "INR",
        imageUrl: "https://placehold.co/300x300?text=Headphones",
        stock: 50,
      },
    }),
    prisma.product.upsert({
      where: { id: "prod-002" },
      update: {},
      create: {
        id: "prod-002",
        name: "Smart Watch",
        description: "Fitness tracking smartwatch with heart rate monitor",
        price: 4999.0,
        currency: "INR",
        imageUrl: "https://placehold.co/300x300?text=SmartWatch",
        stock: 30,
      },
    }),
    prisma.product.upsert({
      where: { id: "prod-003" },
      update: {},
      create: {
        id: "prod-003",
        name: "USB-C Hub",
        description: "7-in-1 USB-C hub with HDMI, USB 3.0, and SD card reader",
        price: 1499.0,
        currency: "INR",
        imageUrl: "https://placehold.co/300x300?text=USB-C+Hub",
        stock: 100,
      },
    }),
  ]);

  const user = await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: {
      id: "user-001",
      email: "test@example.com",
      name: "Test Customer",
      phone: "+919876543210",
    },
  });

  console.log("Seeded products:", products.map((p) => p.name));
  console.log("Seeded user:", user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
