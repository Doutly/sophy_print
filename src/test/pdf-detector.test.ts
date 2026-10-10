import { describe, expect, it } from "vitest";
import { detectPdfPageCount } from "@/lib/pdf-detector";

describe("detectPdfPageCount", () => {
  it("detects pages from /Type /Pages /Count 14 dictionary", async () => {
    const mockPdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 14 >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF`;

    const blob = new Blob([mockPdfContent], { type: "application/pdf" });
    const file = new File([blob], "sample.pdf", { type: "application/pdf" });

    const pages = await detectPdfPageCount(file);
    expect(pages).toBe(14);
  });

  it("detects pages by counting individual /Type /Page objects", async () => {
    const mockPdfContent = `%PDF-1.4
3 0 obj
<< /Type /Page >>
endobj
4 0 obj
<< /Type /Page >>
endobj
5 0 obj
<< /Type /Page >>
endobj
%%EOF`;

    const blob = new Blob([mockPdfContent], { type: "application/pdf" });
    const file = new File([blob], "notes.pdf", { type: "application/pdf" });

    const pages = await detectPdfPageCount(file);
    expect(pages).toBe(3);
  });

  it("defaults to 1 page for invalid or empty content safely", async () => {
    const blob = new Blob(["not a pdf"], { type: "application/pdf" });
    const file = new File([blob], "corrupted.pdf", { type: "application/pdf" });

    const pages = await detectPdfPageCount(file);
    expect(pages).toBe(1);
  });
});
