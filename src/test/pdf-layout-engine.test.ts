import { describe, it, expect } from "vitest";
import {
  computeSheetMetrics,
  resolvePageIndices,
  transformPdfLayout,
  stampOrderIdOnPdf,
  DEFAULT_PRINT_LAYOUT_CONFIG,
} from "../lib/pdf-layout-engine";
import { PDFDocument } from "pdf-lib";

describe("PDF Layout Engine & Sheet Metrics", () => {
  it("resolves all pages correctly", () => {
    const indices = resolvePageIndices(5, "all");
    expect(indices).toEqual([0, 1, 2, 3, 4]);
  });

  it("resolves odd and even pages correctly", () => {
    const odd = resolvePageIndices(6, "odd");
    expect(odd).toEqual([0, 2, 4]); // 1, 3, 5

    const even = resolvePageIndices(6, "even");
    expect(even).toEqual([1, 3, 5]); // 2, 4, 6
  });

  it("resolves custom ranges and reverses if requested", () => {
    const custom = resolvePageIndices(10, "custom", "1-3, 7");
    expect(custom).toEqual([0, 1, 2, 6]);

    const reversed = resolvePageIndices(10, "custom", "1-3, 7", 1, true);
    expect(reversed).toEqual([6, 2, 1, 0]);
  });

  it("computes physical sheet metrics for single-sided vs double-sided N-up", () => {
    // 8 pages, 1-on-1, single sided -> 8 faces, 8 physical sheets
    const single1Up = computeSheetMetrics(8, 1, "single");
    expect(single1Up.printedFaces).toBe(8);
    expect(single1Up.physicalSheets).toBe(8);

    // 8 pages, 1-on-1, double sided -> 8 faces, 4 physical sheets
    const double1Up = computeSheetMetrics(8, 1, "duplex-long");
    expect(double1Up.printedFaces).toBe(8);
    expect(double1Up.physicalSheets).toBe(4);

    // 8 pages, 2-on-1 (2-up), single sided -> 4 faces, 4 physical sheets
    const single2Up = computeSheetMetrics(8, 2, "single");
    expect(single2Up.printedFaces).toBe(4);
    expect(single2Up.physicalSheets).toBe(4);

    // 8 pages, 2-on-1 (2-up), double sided -> 4 faces, 2 physical sheets
    const double2Up = computeSheetMetrics(8, 2, "duplex-long");
    expect(double2Up.printedFaces).toBe(4);
    expect(double2Up.physicalSheets).toBe(2);

    // 8 pages, 4-on-1 (2x2 grid), single sided -> 2 faces, 2 physical sheets
    const single4Up = computeSheetMetrics(8, 4, "single");
    expect(single4Up.printedFaces).toBe(2);
    expect(single4Up.physicalSheets).toBe(2);

    // 8 pages, 4-on-1 (2x2 grid), double sided -> 2 faces, 1 physical sheet!
    const double4Up = computeSheetMetrics(8, 4, "duplex-long");
    expect(double4Up.printedFaces).toBe(2);
    expect(double4Up.physicalSheets).toBe(1);
  });

  it("transforms a blank multi-page PDF into 2-on-1 and 4-on-1 layouts", async () => {
    // Create a 4-page dummy PDF with content
    const doc = await PDFDocument.create();
    for (let i = 1; i <= 4; i++) {
      const p = doc.addPage([595, 842]);
      p.drawText(`Sample Page ${i}`, { x: 50, y: 800, size: 24 });
    }
    const pdfBytes = await doc.save();

    // Transform to 2-on-1 (should produce 2 sheets)
    const result2Up = await transformPdfLayout(pdfBytes, {
      ...DEFAULT_PRINT_LAYOUT_CONFIG,
      pagesPerSheet: 2,
    });
    expect(result2Up.sheetCount).toBe(2);

    // Transform to 4-on-1 (2x2 grid, should produce 1 sheet)
    const result4Up = await transformPdfLayout(pdfBytes, {
      ...DEFAULT_PRINT_LAYOUT_CONFIG,
      pagesPerSheet: 4,
    });
    expect(result4Up.sheetCount).toBe(1);
  });

  it("handles the user's exact case: 32 pages with 1:4 (4-up) double-sided yields 8 faces and 4 physical sheets", () => {
    // 32 original pages with 1:4 (4 pages per sheet):
    // Single-sided: 8 faces on 8 physical sheets
    const single = computeSheetMetrics(32, 4, "single");
    expect(single.printedFaces).toBe(8);
    expect(single.physicalSheets).toBe(8);

    // Double-sided (Long edge flip): 8 faces on 4 physical sheets (Front + Back)
    const duplexLong = computeSheetMetrics(32, 4, "duplex-long");
    expect(duplexLong.printedFaces).toBe(8);
    expect(duplexLong.physicalSheets).toBe(4);
    expect(duplexLong.isDuplex).toBe(true);

    // Double-sided (Short edge flip): 8 faces on 4 physical sheets (Front + Back)
    const duplexShort = computeSheetMetrics(32, 4, "duplex-short");
    expect(duplexShort.printedFaces).toBe(8);
    expect(duplexShort.physicalSheets).toBe(4);
    expect(duplexShort.isDuplex).toBe(true);
  });

  it("stamps tiny Order ID on each sheet of a document", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]);
    doc.addPage([595, 842]);
    const originalBytes = await doc.save();

    const stampedBytes = await stampOrderIdOnPdf(originalBytes, "2762");
    expect(stampedBytes.length).toBeGreaterThan(0);

    const reloaded = await PDFDocument.load(stampedBytes);
    expect(reloaded.getPageCount()).toBe(2);
  });
});
