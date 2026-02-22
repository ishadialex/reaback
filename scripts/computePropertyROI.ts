import { prisma } from "../src/config/database.js";

/**
 * Migration Script: Compute expectedROI for existing Properties
 *
 * Formula (matches properties.controller.ts):
 *   expectedROI = Math.round(monthlyReturn * duration * 100) / 100
 *
 * Only updates properties where expectedROI is 0 (or missing) but
 * monthlyReturn > 0, so manually-set values are never overwritten.
 * Pass --all to recompute every property regardless.
 */

const forceAll = process.argv.includes("--all");

async function computePropertyROI() {
  console.log("🚀 Starting expectedROI computation for properties...\n");
  console.log(`Mode: ${forceAll ? "ALL properties (--all)" : "Only properties where expectedROI = 0"}\n`);

  try {
    const properties = await prisma.property.findMany({
      select: {
        id: true,
        title: true,
        monthlyReturn: true,
        duration: true,
        expectedROI: true,
      },
    });

    console.log(`📊 Found ${properties.length} properties\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let noDataCount = 0;

    for (const prop of properties) {
      const needsUpdate = forceAll || prop.expectedROI === 0;

      if (!needsUpdate) {
        console.log(`⏭️  "${prop.title}" — already set (expectedROI: ${prop.expectedROI}%)`);
        skippedCount++;
        continue;
      }

      if (prop.monthlyReturn === 0) {
        console.log(`⚠️  "${prop.title}" — monthlyReturn is 0, cannot compute ROI`);
        noDataCount++;
        continue;
      }

      const computed = Math.round(prop.monthlyReturn * prop.duration * 100) / 100;

      await prisma.property.update({
        where: { id: prop.id },
        data: { expectedROI: computed },
      });

      console.log(
        `✅ "${prop.title}" — monthlyReturn: ${prop.monthlyReturn}% × duration: ${prop.duration} months → expectedROI: ${computed}%`
      );
      updatedCount++;
    }

    console.log("\n────────────────────────────────────");
    console.log(`✅ Updated:  ${updatedCount} properties`);
    console.log(`⏭️  Skipped:  ${skippedCount} properties (already had a value)`);
    console.log(`⚠️  No data:  ${noDataCount} properties (monthlyReturn = 0)`);
    console.log("────────────────────────────────────\n");
    console.log("Done.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

computePropertyROI();
