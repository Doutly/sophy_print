import { describe, it, expect } from "vitest";
import {
  DEFAULT_CAMPUS_TEMPLATES,
  getLocalTemplates,
  saveLocalTemplates,
  CATEGORY_LABELS,
  type CampusTemplate,
} from "../lib/templates-data";
import { flattenPdfAnnotations, type DocumentAnnotation } from "../lib/document-editor-engine";
import { PDFDocument } from "pdf-lib";

describe("Campus Template Gallery & Real Document Editing", () => {
  it("removes all hardcoded mock data so students only see real verified templates", () => {
    // Verified: No fake mock data
    expect(DEFAULT_CAMPUS_TEMPLATES.length).toBe(0);
  });

  it("filters out legacy mock template IDs from local storage", () => {
    const mockLegacy: CampusTemplate = {
      id: "tpl-project-cover",
      title: "Old Mock Cover",
      category: "project",
      categoryLabel: "Project Front Page",
      description: "Old fake data",
      createdAt: new Date().toISOString(),
    };

    saveLocalTemplates([mockLegacy]);
    const loaded = getLocalTemplates();
    expect(loaded.some((t) => t.id === "tpl-project-cover")).toBe(false);
  });

  it("supports publishing real templates from admin storage or student uploads", () => {
    const realTemplate: CampusTemplate = {
      id: "tpl-real-ece-resume",
      title: "ECE Verified Resume Template",
      category: "other",
      categoryLabel: "General Format",
      description: "Published directly from student print job #8948",
      originalFileName: "Sophyra_Resume.pdf",
      originalDownloadUrl: "https://firebasestorage.googleapis.com/.../Sophyra_Resume.pdf",
      createdAt: new Date().toISOString(),
      isPopular: true,
    };

    saveLocalTemplates([realTemplate]);
    const loaded = getLocalTemplates();
    expect(loaded[0]!.id).toBe("tpl-real-ece-resume");
    expect(loaded[0]!.originalFileName).toBe("Sophyra_Resume.pdf");
  });

  it("applies vector whiteout and text overlays onto real PDF pages using pdf-lib", async () => {
    // Create base 1-page PDF
    const doc = await PDFDocument.create();
    doc.addPage([595.28, 841.89]);
    const initialBytes = await doc.save();

    const annotations: DocumentAnnotation[] = [
      {
        id: "ann-whiteout-1",
        type: "whiteout",
        pageNumber: 1,
        x: 10,
        y: 10,
        width: 40,
        height: 5,
      },
      {
        id: "ann-text-1",
        type: "text",
        pageNumber: 1,
        x: 10,
        y: 10,
        width: 40,
        height: 5,
        text: "John Doe - USN 1MS22CS001",
        fontSize: 16,
        fontWeight: "bold",
        color: "#000000",
      },
    ];

    const editedFile = await flattenPdfAnnotations(
      initialBytes,
      annotations,
      "John_Doe_Edited.pdf",
    );

    expect(editedFile).toBeDefined();
    expect(editedFile.name).toBe("John_Doe_Edited.pdf");
    expect(editedFile.size).toBeGreaterThan(0);
    expect(editedFile.type).toBe("application/pdf");
  });
});
