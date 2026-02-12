-- Fix PDF document URLs
-- Change from /api/pdf/serve/filename.pdf to /pdfs/filename.pdf

UPDATE "PdfDocument"
SET
  "fileUrl" = '/pdfs/available-arbitrary-opportunities.pdf',
  "filePath" = '/pdfs/available-arbitrary-opportunities.pdf',
  "updatedAt" = NOW()
WHERE id = '698d107c50b2aa53fbc65cc0';

UPDATE "PdfDocument"
SET
  "fileUrl" = '/pdfs/available-arbitrary-opportunities.pdf',
  "filePath" = '/pdfs/available-arbitrary-opportunities.pdf',
  "updatedAt" = NOW()
WHERE id = '698d13075b695aa64b92c963';

-- Optional: Delete the duplicate (the one with space in filename)
-- DELETE FROM "PdfDocument" WHERE id = '698d107c50b2aa53fbc65cc0';
