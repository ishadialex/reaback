import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const USER_ID = "698cec456e96e4519d9bbf50";

async function main() {
  const [tx, fo, ref, inv] = await Promise.all([
    prisma.transaction.deleteMany({ where: { userId: USER_ID } }),
    prisma.fundOperation.deleteMany({ where: { userId: USER_ID } }),
    prisma.referral.deleteMany({
      where: { OR: [{ referrerId: USER_ID }, { referredUserId: USER_ID }] },
    }),
    prisma.userInvestment.deleteMany({ where: { userId: USER_ID } }),
  ]);
  console.log(`Deleted: ${tx.count} transactions, ${fo.count} fund ops, ${ref.count} referrals, ${inv.count} investments`);
  // Optionally reset balance too:
  await prisma.user.update({
    where: { id: USER_ID },
    data: { balance: 0 },
  });
  console.log("Balance reset to 0");
}

main().finally(() => prisma.$disconnect());
