import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function addFirstPdf() {
  console.log("📄 Adding PDF to database...\n");

  try {
    const pdf = await prisma.pdfDocument.create({
      data: {
        title: "Available Arbitrary Opportunities",
        description: "Investment opportunities available for arbitrage",
        filePath: "public/pdfs/available-arbitrary-opportunities.pdf",
        fileUrl: "/pdfs/available-arbitrary-opportunities.pdf",
        displayOrder: 1,
        category: "Investment",
        isActive: true,
      },
    });

    console.log("✅ PDF added successfully!");
    console.log("\nDetails:");
    console.log(`  ID: ${pdf.id}`);
    console.log(`  Title: ${pdf.title}`);
    console.log(`  File URL: ${pdf.fileUrl}`);
    console.log(`  Category: ${pdf.category}`);
    console.log(`  Display Order: ${pdf.displayOrder}`);
    console.log("\n🎉 You can now view this PDF in the frontend!");
  } catch (error) {
    console.error("❌ Error adding PDF:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addFirstPdf();
