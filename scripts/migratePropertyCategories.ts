import { prisma } from "../src/config/database.js";

/**
 * Migration Script: Migrate old property category values to new ones
 *
 * Old → New mapping:
 *   "arbitrage" → "airbnb_arbitrage"
 *   "mortgage"  → "airbnb_mortgage"
 *   "airbnb"    → "airbnb_arbitrage"   (best-guess; review manually if needed)
 *
 * Also validates investmentType+category combinations after migration:
 *   pooled     → airbnb_arbitrage | airbnb_mortgage
 *   individual → airbnb_arbitrage | airbnb_mortgage | for_sale
 *
 * Pass --dry-run to preview changes without writing to DB.
 */

const dryRun = process.argv.includes("--dry-run");

const CATEGORY_MAP: Record<string, string> = {
  arbitrage: "airbnb_arbitrage",
  mortgage: "airbnb_mortgage",
  airbnb: "airbnb_arbitrage",
};

const VALID_CATEGORIES: Record<string, string[]> = {
  pooled: ["airbnb_arbitrage", "airbnb_mortgage"],
  individual: ["airbnb_arbitrage", "airbnb_mortgage", "for_sale"],
};

async function migratePropertyCategories() {
  console.log(`\n🚀 Property Category Migration`);
  console.log(`Mode: ${dryRun ? "DRY RUN (no DB writes)" : "LIVE"}\n`);

  const properties = await prisma.property.findMany({
    select: { id: true, title: true, category: true, investmentType: true },
  });

  console.log(`📊 Found ${properties.length} properties\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let invalidCount = 0;

  for (const prop of properties) {
    const newCategory = CATEGORY_MAP[prop.category] ?? prop.category;
    const needsRename = newCategory !== prop.category;
    const allowed = VALID_CATEGORIES[prop.investmentType] ?? [];
    const isValid = allowed.includes(newCategory);

    if (!isValid) {
      console.log(
        `❌ "${prop.title}" — investmentType: ${prop.investmentType}, category: ${prop.category} → ${newCategory} (INVALID COMBO — fix manually)`
      );
      invalidCount++;
      continue;
    }

    if (!needsRename) {
      console.log(`⏭️  "${prop.title}" — category already "${prop.category}" (ok)`);
      skippedCount++;
      continue;
    }

    console.log(`✅ "${prop.title}" — "${prop.category}" → "${newCategory}"`);

    if (!dryRun) {
      await prisma.property.update({
        where: { id: prop.id },
        data: { category: newCategory },
      });
    }

    updatedCount++;
  }

  console.log("\n────────────────────────────────────");
  console.log(`✅ Updated:  ${updatedCount} properties${dryRun ? " (dry run)" : ""}`);
  console.log(`⏭️  Skipped:  ${skippedCount} properties (already valid)`);
  console.log(`❌ Invalid:  ${invalidCount} properties (manual fix needed)`);
  console.log("────────────────────────────────────\n");

  await prisma.$disconnect();
}

migratePropertyCategories().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
