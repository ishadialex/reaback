import { prisma } from "../src/config/database.js";

async function run() {
  const result = await prisma.property.updateMany({
    where: { category: "for_sale" },
    data: { bidCount: 0, recentBidAmount: 0 } as any,
  });
  console.log(`✅ Seeded bidCount + recentBidAmount on ${result.count} for_sale properties`);
  await prisma.$disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
