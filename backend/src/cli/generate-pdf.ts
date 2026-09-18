/**
 * PDF worker for Laravel — uses existing pdf-lib services against MySQL.
 *
 * Usage:
 *   bun src/cli/generate-pdf.ts form <formId> <outPath>
 *   bun src/cli/generate-pdf.ts ticket <ticketId> <outPath>
 */
import fs from "node:fs";
import { connectDb, closeDb } from "../db.js";
import { generateFormPreviewPdf } from "../services/formDocumentService.js";
import { generateTicketDocumentPdf } from "../services/ticketDocumentService.js";

async function main() {
  const [kind, id, outPath] = process.argv.slice(2);
  if (!kind || !id || !outPath || !["form", "ticket"].includes(kind)) {
    console.error("Usage: bun src/cli/generate-pdf.ts <form|ticket> <id> <outPath>");
    process.exit(2);
  }

  await connectDb();
  try {
    const bytes =
      kind === "form"
        ? await generateFormPreviewPdf(id)
        : await generateTicketDocumentPdf(id);
    fs.writeFileSync(outPath, Buffer.from(bytes));
    process.stdout.write(`OK ${bytes.length}\n`);
  } finally {
    await closeDb();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
