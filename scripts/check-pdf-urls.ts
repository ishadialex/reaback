import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPdfUrls() {
  try {
    const pdfs = await prisma.pdfDocument.findMany();

    console.log('\n📋 Current PDF URLs in database:\n');
    pdfs.forEach((pdf, index) => {
      console.log(`${index + 1}. ${pdf.title}`);
      console.log(`   fileUrl: ${pdf.fileUrl}`);
      console.log(`   filePath: ${pdf.filePath}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPdfUrls();
