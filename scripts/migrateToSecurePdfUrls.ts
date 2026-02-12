/**
 * Migration Script: Update PDF URLs to Secure Endpoint
 *
 * This script updates all PDF document records to use the new secure
 * /api/pdf/serve/:filename endpoint instead of the old /pdfs/:filename
 *
 * Run with: npx tsx scripts/migrateToSecurePdfUrls.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateToSecurePdfUrls() {
  console.log("🔄 Starting PDF URL migration...\n");

  try {
    // Find all PDF documents
    const documents = await prisma.pdfDocument.findMany();

    console.log(`Found ${documents.length} PDF document(s) in database\n`);

    if (documents.length === 0) {
      console.log("✅ No documents to migrate");
      return;
    }

    let updatedCount = 0;
    let skippedCount = 0;

    for (const doc of documents) {
      const oldUrl = doc.fileUrl;

      // Check if URL needs migration
      if (oldUrl.startsWith("/pdfs/")) {
        const filename = oldUrl.replace("/pdfs/", "");
        const newUrl = `/api/pdf/serve/${filename}`;

        console.log(`📄 ${doc.title}`);
        console.log(`   Old: ${oldUrl}`);
        console.log(`   New: ${newUrl}`);

        // Update the document
        await prisma.pdfDocument.update({
          where: { id: doc.id },
          data: { fileUrl: newUrl },
        });

        updatedCount++;
        console.log(`   ✅ Updated\n`);
      } else if (oldUrl.startsWith("/api/pdf/serve/")) {
        console.log(`📄 ${doc.title}`);
        console.log(`   Current: ${oldUrl}`);
        console.log(`   ⏭️  Already migrated, skipping\n`);
        skippedCount++;
      } else {
        console.log(`📄 ${doc.title}`);
        console.log(`   Current: ${oldUrl}`);
        console.log(`   ⚠️  Unknown URL format, skipping\n`);
        skippedCount++;
      }
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`✅ Migration complete!`);
    console.log(`   Total documents: ${documents.length}`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    if (updatedCount > 0) {
      console.log("🔒 PDFs are now secured!");
      console.log("⚠️  Important: Update your frontend to append passcode to URLs");
      console.log("   Example: /api/pdf/serve/file.pdf?passcode=YOUR_PASSCODE\n");
    }

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateToSecurePdfUrls()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
