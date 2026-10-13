import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface DocumentAnnotation {
  id: string;
  type: "text" | "whiteout";
  pageNumber: number; // 1-indexed
  x: number; // percentage 0..100 from left
  y: number; // percentage 0..100 from top
  width: number; // percentage of page width
  height: number; // percentage of page height
  text?: string;
  fontSize?: number; // font size in px/pt (default 14)
  fontWeight?: "normal" | "bold";
  color?: string; // hex color e.g. #000000
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace("#", "");
  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return { r: 0, g: 0, b: 0 };
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

let pdfjsCache: any = null;

/**
 * Dynamically load PDF.js in the browser
 */
export async function getPdfJs() {
  if (pdfjsCache) return pdfjsCache;
  if (typeof window === "undefined") {
    throw new Error("PDF.js can only be loaded in a browser environment");
  }

  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }
  pdfjsCache = pdfjs;
  return pdfjs;
}

/**
 * Render a single page of a PDF directly to an HTML canvas
 */
export async function renderPdfPageToCanvas(
  source: ArrayBuffer | Uint8Array,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  desiredWidth = 800,
): Promise<{ totalPages: number; width: number; height: number }> {
  const pdfjs = await getPdfJs();
  const loadingTask = pdfjs.getDocument({ data: source });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;

  const validPageNum = Math.max(1, Math.min(pageNumber, totalPages));
  const page = await pdf.getPage(validPageNum);

  const initialViewport = page.getViewport({ scale: 1 });
  const scale = desiredWidth / initialViewport.width;
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire 2D canvas context");

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport,
  };

  await page.render(renderContext).promise;

  return {
    totalPages,
    width: viewport.width,
    height: viewport.height,
  };
}

/**
 * Apply whiteouts and text overlay annotations directly into the PDF using vector primitives
 */
export async function flattenPdfAnnotations(
  originalBytes: ArrayBuffer | Uint8Array,
  annotations: DocumentAnnotation[],
  outputFileName = "Customized_Document.pdf",
): Promise<File> {
  const pdfDoc = await PDFDocument.load(originalBytes);
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageCount = pdfDoc.getPageCount();

  for (const ann of annotations) {
    if (ann.pageNumber < 1 || ann.pageNumber > pageCount) continue;
    const page = pdfDoc.getPage(ann.pageNumber - 1);
    const pw = page.getWidth();
    const ph = page.getHeight();

    if (ann.type === "whiteout") {
      const rectX = (ann.x / 100) * pw;
      const rectW = (ann.width / 100) * pw;
      const rectH = (ann.height / 100) * ph;
      // In PDF, Y starts from bottom
      const rectY = ph - ((ann.y + ann.height) / 100) * ph;

      page.drawRectangle({
        x: rectX,
        y: rectY,
        width: rectW,
        height: rectH,
        color: rgb(1, 1, 1),
      });
    } else if (ann.type === "text" && ann.text) {
      const textX = (ann.x / 100) * pw;
      const fontSize = ann.fontSize || 14;
      // Text baseline
      const textY = ph - (ann.y / 100) * ph - fontSize;
      const font = ann.fontWeight === "bold" ? helveticaBold : helveticaFont;
      const col = parseHexColor(ann.color || "#000000");

      page.drawText(ann.text, {
        x: textX,
        y: textY,
        size: fontSize,
        font,
        color: rgb(col.r, col.g, col.b),
      });
    }
  }

  const modifiedBytes = await pdfDoc.save();
  return new File([modifiedBytes as Uint8Array<ArrayBuffer>], outputFileName, {
    type: "application/pdf",
  });
}

/**
 * Create a fresh printable PDF from scratch (used if a template starts from an image or blank sheet)
 */
export async function createPdfFromCanvas(
  canvas: HTMLCanvasElement,
  outputFileName = "Customized_Document.pdf",
): Promise<File> {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
  const pdfDoc = await PDFDocument.create();

  // A4 standard points: 595.28 x 841.89
  const page = pdfDoc.addPage([595.28, 841.89]);
  const imageBytes = await fetch(dataUrl).then((res) => res.arrayBuffer());
  const jpgImage = await pdfDoc.embedJpg(imageBytes);

  page.drawImage(jpgImage, {
    x: 0,
    y: 0,
    width: 595.28,
    height: 841.89,
  });

  const pdfBytes = await pdfDoc.save();
  return new File([pdfBytes as Uint8Array<ArrayBuffer>], outputFileName, {
    type: "application/pdf",
  });
}
