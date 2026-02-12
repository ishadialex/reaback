import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPdfUrls() {
  try {
    console.log('🔧 Fixing PDF URLs in database...\n');

    // Get all PDF documents with incorrect URLs
    const documents = await prisma.pdfDocument.findMany({
      where: {
        OR: [
          { fileUrl: { contains: '/api/pdf/serve/' } },
          { filePath: { contains: '/api/pdf/serve/' } },
        ],
      },
    });

    console.log(`Found ${documents.length} PDF document(s) with incorrect URLs\n`);

    // Fix each document
    for (const doc of documents) {
      console.log(`Updating: ${doc.title}`);
      console.log(`  Old fileUrl: ${doc.fileUrl}`);

      // Extract filename from the incorrect URL
      // /api/pdf/serve/filename.pdf -> filename.pdf
      const filename = doc.fileUrl.split('/').pop();
      const correctFileUrl = `/pdfs/${filename}`;
      const correctFilePath = `/pdfs/${filename}`;

      console.log(`  New fileUrl: ${correctFileUrl}\n`);

      // Update the document
      await prisma.pdfDocument.update({
        where: { id: doc.id },
        data: {
          fileUrl: correctFileUrl,
          filePath: correctFilePath,
          updatedAt: new Date(),
        },
      });

      console.log(`✅ Updated successfully!\n`);
    }

    console.log('🎉 All PDF URLs have been fixed!');
    console.log('\nVerifying updates...\n');

    // Verify the updates
    const updatedDocs = await prisma.pdfDocument.findMany({
      where: { isActive: true },
    });

    updatedDocs.forEach((doc) => {
      console.log(`📄 ${doc.title}`);
      console.log(`   fileUrl: ${doc.fileUrl}`);
      console.log(`   filePath: ${doc.filePath}\n`);
    });

    console.log('✅ Done! PDFs should now load correctly.');
  } catch (error) {
    console.error('❌ Error fixing PDF URLs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPdfUrls();
