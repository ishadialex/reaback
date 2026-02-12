import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removePasscodeFromUrls() {
  try {
    console.log('🔍 Checking for URLs with embedded passcodes...\n');

    // Find all PDF documents
    const documents = await prisma.pdfDocument.findMany();
    let fixedCount = 0;

    for (const doc of documents) {
      let needsUpdate = false;
      let newFileUrl = doc.fileUrl;
      let newFilePath = doc.filePath;

      // Check if URL contains passcode parameter or old /api/pdf/serve/ format
      if (doc.fileUrl.includes('passcode=') || doc.fileUrl.includes('/api/pdf/serve/')) {
        console.log(`❌ Found problematic URL in: ${doc.title}`);
        console.log(`   Current: ${doc.fileUrl}`);

        // Extract just the filename
        const urlParts = doc.fileUrl.split(/[?&]/)[0]; // Remove query parameters
        const filename = urlParts.split('/').pop(); // Get filename
        newFileUrl = `/pdfs/${filename}`;
        newFilePath = `/pdfs/${filename}`;
        needsUpdate = true;

        console.log(`   Fixed to: ${newFileUrl}\n`);
      }

      if (needsUpdate) {
        await prisma.pdfDocument.update({
          where: { id: doc.id },
          data: {
            fileUrl: newFileUrl,
            filePath: newFilePath,
            updatedAt: new Date(),
          },
        });
        fixedCount++;
      }
    }

    if (fixedCount === 0) {
      console.log('✅ No problematic URLs found! Database is clean.');
    } else {
      console.log(`✅ Fixed ${fixedCount} URL(s) in the database.`);
    }

    console.log('\n📋 Current PDF URLs:\n');
    const updatedDocs = await prisma.pdfDocument.findMany();
    updatedDocs.forEach((doc, index) => {
      console.log(`${index + 1}. ${doc.title}`);
      console.log(`   ${doc.fileUrl}\n`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

removePasscodeFromUrls();
