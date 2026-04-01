import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient;
}

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    global.prismaGlobal = new PrismaClient({ adapter: adapter });
  }
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = global.prismaGlobal ?? new PrismaClient({ adapter: adapter });

export default prisma;