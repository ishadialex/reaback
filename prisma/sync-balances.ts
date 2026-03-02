/**
 * One-time migration: sync every user's stored `balance` field to match
 * the transaction-computed total. Run with:
 *
 *   npx tsx prisma/sync-balances.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, balance: true } });
  console.log(`Syncing ${users.length} users...`);

  let updated = 0;
  for (const user of users) {
    const txs = await prisma.transaction.findMany({
      where: { userId: user.id, status: "completed" },
      select: { type: true, amount: true },
    });

    let balance = 0;
    for (const tx of txs) {
      switch (tx.type) {
        case "deposit":
        case "profit":
        case "admin_profits":
        case "admin_bonus":
        case "admin_referralCommissions":
        case "admin_balance":
        case "referral":
        case "transfer_received":
          balance += tx.amount;
          break;
        case "withdrawal":
        case "investment":
        case "transfer_sent":
          balance -= Math.abs(tx.amount);
          break;
      }
    }

    if (Math.abs(balance - user.balance) > 0.001) {
      console.log(`  ${user.email}: DB=${user.balance} → computed=${balance}`);
      await prisma.user.update({ where: { id: user.id }, data: { balance } });
      updated++;
    }
  }

  console.log(`Done. Updated ${updated} / ${users.length} users.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
