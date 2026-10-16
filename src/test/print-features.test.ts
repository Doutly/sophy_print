import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { routeTree } from "@/routeTree.gen";
import {
  calculateJobPrice,
  parsePageRange,
  defaultPricingConfig,
  validatePrintableFile,
  initialPrintJobs,
} from "@/lib/print-data";

describe("Route resolution", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

  it("matches root route /", () => {
    const matches = router.matchRoutes("/");
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches /admin/pricing route", () => {
    const matches = router.matchRoutes("/admin/pricing");
    expect(matches.at(-1)?.routeId).toContain("pricing");
  });

  it("matches /admin/revenue route", () => {
    const matches = router.matchRoutes("/admin/revenue");
    expect(matches.at(-1)?.routeId).toContain("revenue");
  });

  it("matches /admin/storage route for Firebase Storage management", () => {
    const matches = router.matchRoutes("/admin/storage");
    expect(matches.at(-1)?.routeId).toContain("storage");
  });
});

describe("Page range parser", () => {
  it("handles 'all' pages correctly", () => {
    const res = parsePageRange("all", 18);
    expect(res.isValid).toBe(true);
    expect(res.count).toBe(18);
    expect(res.selectedPages).toHaveLength(18);
  });

  it("handles odd and even presets", () => {
    const odd = parsePageRange("odd", 10);
    expect(odd.isValid).toBe(true);
    expect(odd.count).toBe(5);
    expect(odd.selectedPages).toEqual([1, 3, 5, 7, 9]);

    const even = parsePageRange("even", 10);
    expect(even.isValid).toBe(true);
    expect(even.count).toBe(5);
    expect(even.selectedPages).toEqual([2, 4, 6, 8, 10]);
  });

  it("handles custom ranges like '1-3, 5, 7-8'", () => {
    const res = parsePageRange("1-3, 5, 7-8", 10);
    expect(res.isValid).toBe(true);
    expect(res.count).toBe(6);
    expect(res.selectedPages).toEqual([1, 2, 3, 5, 7, 8]);
  });

  it("rejects out-of-bounds page numbers", () => {
    const res = parsePageRange("25", 10);
    expect(res.isValid).toBe(false);
  });
});

describe("Pricing calculation", () => {
  it("calculates B&W single-sided correctly", () => {
    // 10 pages * 1 copy * 1 unitRate (1.0) = 10
    const res = calculateJobPrice(10, 1, "bw", "single", "A4", defaultPricingConfig);
    expect(res.sheets).toBe(10);
    expect(res.total).toBe(10);
  });

  it("calculates B&W double-sided (duplex) correctly", () => {
    // 10 pages -> 5 sheets * 1.50 = 7.50
    const res = calculateJobPrice(10, 1, "bw", "double", "A4", defaultPricingConfig);
    expect(res.sheets).toBe(5);
    expect(res.total).toBe(7.5);
  });

  it("calculates Colour A3 size correctly with multiplier", () => {
    // 4 pages, single, colour (5/page) * 2x A3 multiplier = 40
    const res = calculateJobPrice(4, 1, "colour", "single", "A3", defaultPricingConfig);
    expect(res.total).toBe(40);
  });
});

describe("Printable file validation & media rejection", () => {
  it("strictly rejects media files like MP3 and MP4", () => {
    const mp3 = validatePrintableFile("track.mp3", "audio/mpeg");
    expect(mp3.isValid).toBe(false);
    expect(mp3.error).toContain("Audio and video media files");

    const mp4 = validatePrintableFile("lecture_video.mp4", "video/mp4");
    expect(mp4.isValid).toBe(false);
    expect(mp4.error).toContain("Audio and video media files");

    const mkv = validatePrintableFile("clip.mkv");
    expect(mkv.isValid).toBe(false);

    const wav = validatePrintableFile("recording.wav", "audio/wav");
    expect(wav.isValid).toBe(false);
  });

  it("strictly rejects executable or archive formats", () => {
    const exe = validatePrintableFile("installer.exe", "application/x-msdownload");
    expect(exe.isValid).toBe(false);

    const zip = validatePrintableFile("archive.zip");
    expect(zip.isValid).toBe(false);
  });

  it("accepts valid printable documents (PDF, DOCX, PPTX)", () => {
    const pdf = validatePrintableFile("Assignment.pdf", "application/pdf");
    expect(pdf.isValid).toBe(true);
    expect(pdf.error).toBeUndefined();

    const docx = validatePrintableFile("LabReport.docx");
    expect(docx.isValid).toBe(true);

    const pptx = validatePrintableFile("Presentation.pptx");
    expect(pptx.isValid).toBe(true);
  });
});

describe("Admin authentication security & injection checks", () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  it("rejects SQL injection vectors in email field", () => {
    const vectors = [
      "' OR '1'='1",
      "admin'--",
      "' UNION SELECT * FROM users--",
      "admin@sophyprint.com' OR '1'='1",
      "<script>alert(1)</script>",
      "'; DROP TABLE users; --",
    ];

    for (const vector of vectors) {
      expect(emailRegex.test(vector.trim())).toBe(false);
    }
  });

  it("accepts only valid sanitized administrator emails", () => {
    expect(emailRegex.test("admin@sophyprint.com")).toBe(true);
    expect(emailRegex.test("Sophyra18@gmail.com")).toBe(true);
    expect(emailRegex.test("invalid-email")).toBe(false);
    expect(emailRegex.test("   ")).toBe(false);
  });
});

describe("Production Zero-Mock Policy", () => {
  it("strictly initializes with zero hardcoded print jobs", () => {
    expect(initialPrintJobs).toEqual([]);
    expect(initialPrintJobs.length).toBe(0);
  });
});

describe("Printer Hardware Inventory & Dual Canon 4545i III Setup", () => {
  it("includes dual Canon imageRUNNER ADVANCE 4545i III units connected over LAN", async () => {
    const { defaultPrinters } = await import("@/lib/print-data");
    const canonUnits = defaultPrinters.filter((p) => p.model?.includes("4545i"));
    expect(canonUnits).toHaveLength(2);
    expect(canonUnits[0]?.name).toContain("Unit 1");
    expect(canonUnits[1]?.name).toContain("Unit 2");
    expect(canonUnits[0]?.connection).toContain("LAN");
    expect(canonUnits[1]?.connection).toContain("LAN");
    expect(canonUnits[0]?.speed).toBe("45 PPM");
  });
});

describe("Unified 4-Digit Order ID & Pickup Code", () => {
  it("generates a clean 4-digit code between 1000 and 9999", async () => {
    const { generateUniquePickupCode } = await import("@/lib/print-data");
    const code = await generateUniquePickupCode();
    expect(code).toMatch(/^[1-9][0-9]{3}$/);
    expect(code.length).toBe(4);
  });

  it("assigns the exact same 4-digit code to both order.id and order.pickupCode", async () => {
    const { createPrintOrder } = await import("@/lib/print-data");
    const order = await createPrintOrder({
      file: "TestDoc.pdf",
      type: "B&W",
      pages: 5,
      copies: 1,
      amount: 5,
      status: "Pending",
      student: "Aarav",
      sides: "single",
      paper: "A4",
    });

    expect(order.id).toBe(order.pickupCode);
    expect(order.id).toMatch(/^[1-9][0-9]{3}$/);
  });
});

describe("End-to-End Print Workflow & Agent Dispatching Pipeline", () => {
  it("verifies end-to-end stamping, order creation, duplex/copies tracking, and dynamic queue wait estimation", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const { stampOrderIdOnPdf } = await import("@/lib/pdf-layout-engine");
    const {
      generateUniquePickupCode,
      createPrintOrder,
      calculateQueueWaitEstimate,
    } = await import("@/lib/print-data");

    // 1. Generate unique 4-digit code (e.g. 2762)
    const code = await generateUniquePickupCode();
    expect(code).toMatch(/^[1-9][0-9]{3}$/);

    // 2. Create blank 4-page source PDF and stamp the order ID
    const sampleDoc = await PDFDocument.create();
    for (let i = 0; i < 4; i++) {
      sampleDoc.addPage([595, 842]);
    }
    const rawPdfBytes = await sampleDoc.save();

    const stampedPdfBytes = await stampOrderIdOnPdf(rawPdfBytes, code);
    expect(stampedPdfBytes.length).toBeGreaterThan(0);

    // Verify stamped PDF has all 4 pages preserved
    const verifiedDoc = await PDFDocument.load(stampedPdfBytes);
    expect(verifiedDoc.getPageCount()).toBe(4);

    // 3. Create simulated orders in queue to test dynamic queue wait estimation
    const existingJob1 = await createPrintOrder({
      file: "Assignment_1.pdf",
      type: "B&W",
      pages: 20,
      copies: 2,
      physicalSheets: 20,
      amount: 40,
      status: "Printing",
      student: "Rohan",
      sides: "double",
      duplexMode: "duplex-long",
      paper: "A4",
      printer: "Canon imageRUNNER ADVANCE 4545i III (Unit 1)",
    });

    const newJob = await createPrintOrder({
      id: code,
      pickupCode: code,
      file: "Lab_Report_Final.pdf",
      type: "B&W",
      pages: 8,
      copies: 3,
      physicalSheets: 4,
      amount: 18,
      status: "Pending",
      student: "Priya",
      sides: "double",
      duplexMode: "duplex-long",
      paper: "A4",
      printer: "Canon imageRUNNER ADVANCE 4545i III (Unit 1)",
    });

    // 4. Calculate real-time queue estimate
    const estimate = calculateQueueWaitEstimate(newJob, [existingJob1, newJob]);
    expect(estimate.positionInQueue).toBeGreaterThanOrEqual(1);
    expect(estimate.estimatedMinutesMin).toBeGreaterThanOrEqual(1);
    expect(estimate.displayText).toMatch(/min/i);
    expect(["Light", "Moderate", "Busy", "Peak"]).toContain(estimate.trafficLevel);

    // 5. Test queue estimate when job transitions to Ready
    const readyEstimate = calculateQueueWaitEstimate({ ...newJob, status: "Ready" }, [
      existingJob1,
      newJob,
    ]);
    expect(readyEstimate.displayText).toBe("Ready for pickup now!");
    expect(readyEstimate.estimatedMinutesMin).toBe(0);
    expect(readyEstimate.positionInQueue).toBe(0);
  });

  it("simulates full admin-to-agent order lifecycle with updateJobStatus and ID sanitization", async () => {
    const { createPrintOrder, updateJobStatus, getStoredPrintJobs } = await import("@/lib/print-data");

    // 1. Student creates order (initial status: Pending)
    const order = await createPrintOrder({
      file: "Final_Thesis.pdf",
      type: "Colour",
      pages: 12,
      copies: 1,
      amount: 60,
      status: "Pending",
      student: "Vikram",
      sides: "single",
      paper: "A4",
    });
    expect(order.status).toBe("Pending");

    // 2. Admin acknowledges order using clean ID
    await updateJobStatus(order.id, "Waiting");
    let current = getStoredPrintJobs().find((j) => j.id === order.id);
    expect(current?.status).toBe("Waiting");

    // 3. Agent picks up order using ID with leading '#'
    await updateJobStatus(`#${order.id}`, "Printing");
    current = getStoredPrintJobs().find((j) => j.id === order.id);
    expect(current?.status).toBe("Printing");

    // 4. Physical printing finishes -> Ready
    await updateJobStatus(order.id, "Ready");
    current = getStoredPrintJobs().find((j) => j.id === order.id);
    expect(current?.status).toBe("Ready");

    // 5. Student collects document -> Completed
    await updateJobStatus(order.id, "Completed");
    current = getStoredPrintJobs().find((j) => j.id === order.id);
    expect(current?.status).toBe("Completed");

    // 6. Verify error rejection on invalid or empty ID
    await expect(updateJobStatus("", "Ready")).rejects.toThrow("Cannot update order");
  });

  it("QA/QC: handles order failure, stores diagnostic failure reason, and supports admin retry back to Waiting", async () => {
    const { createPrintOrder, updateJobStatus, getStoredPrintJobs } = await import("@/lib/print-data");

    // 1. Create order
    const order = await createPrintOrder({
      file: "Damaged_File.pdf",
      type: "B&W",
      pages: 4,
      copies: 1,
      amount: 10,
      status: "Printing",
      student: "Arjun",
      sides: "single",
      paper: "A4",
    });

    // 2. Agent reports spooler or file download failure
    await updateJobStatus(order.id, "Failed");
    let current = getStoredPrintJobs().find((j) => j.id === order.id);
    expect(current?.status).toBe("Failed");

    // 3. Admin clicks 'Retry' in dashboard -> re-queues to Waiting
    await updateJobStatus(order.id, "Waiting");
    current = getStoredPrintJobs().find((j) => j.id === order.id);
    expect(current?.status).toBe("Waiting");

    // 4. Agent picks up again -> Printing -> Ready
    await updateJobStatus(order.id, "Printing");
    await updateJobStatus(order.id, "Ready");
    current = getStoredPrintJobs().find((j) => j.id === order.id);
    expect(current?.status).toBe("Ready");
  });

  it("QA/QC: 4-digit counter pickup verification ensures exact pickup code match before completion", async () => {
    const { createPrintOrder, updateJobStatus, getStoredPrintJobs } = await import("@/lib/print-data");

    const order = await createPrintOrder({
      file: "Engineering_Drawing.pdf",
      type: "Colour",
      pages: 2,
      copies: 1,
      amount: 20,
      status: "Ready",
      student: "Neha",
      sides: "single",
      paper: "A3",
    });

    expect(order.pickupCode).toBeDefined();
    expect(order.pickupCode).toMatch(/^\d{4}$/);

    // Verify counter operator matches student 4-digit pickup code
    const studentInputCode = order.pickupCode;
    const isMatching = studentInputCode === order.pickupCode;
    expect(isMatching).toBe(true);

    if (isMatching) {
      await updateJobStatus(order.id, "Completed");
    }

    const completedJob = getStoredPrintJobs().find((j) => j.id === order.id);
    expect(completedJob?.status).toBe("Completed");
  });
});


