import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/reprun?schema=public";

  if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in production.");
  }

  const adapter = new PrismaPg(connectionString);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

// Reuse the Prisma instance during Next dev hot reloads so file refreshes do not
// create a new Postgres connection pool each time.
export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
