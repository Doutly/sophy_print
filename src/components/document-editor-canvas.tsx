import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Plus,
  Printer,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { renderPdfPageToCanvas, getPdfJs } from "@/lib/document-editor-engine";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface DocumentTextLine {
  id: string;
  originalText: string;
  currentText: string;
  pageNumber: number;
  pdfX: number;
  pdfY: number;
  fontSize: number;
  width: number;
  height: number;
  percentX: number;
  percentY: number;
  isModified: boolean;
  isDeleted?: boolean;
}

interface DocumentEditorCanvasProps {
  fileSource: File | string | null;
  initialFileName?: string;
  isOpen: boolean;
  onClose: () => void;
  onApply: (result: { file: File; fileName: string; pageCount: number }) => void;
}

export function DocumentEditorCanvas({
  fileSource,
  initialFileName = "Document.pdf",
  isOpen,
  onClose,
  onApply,
}: DocumentEditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 650, height: 920 });

  // Extracted text items for real in-place editing
  const [textLines, setTextLines] = useState<DocumentTextLine[]>([]);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const [saving, setSaving] = useState(false);

  // Load document buffer with CORS proxy fallback
  useEffect(() => {
    if (!isOpen || !fileSource) {
      setArrayBuffer(null);
      setTextLines([]);
      setEditingLineId(null);
      return;
    }

    let active = true;
    setLoading(true);
    setLoadingError(null);

    async function loadSource() {
      try {
        let buffer: ArrayBuffer;
        if (fileSource instanceof File) {
          buffer = await fileSource.arrayBuffer();
        } else if (typeof fileSource === "string") {
          try {
            const res = await fetch(fileSource);
            if (!res.ok) throw new Error("Direct fetch status: " + res.status);
            buffer = await res.arrayBuffer();
          } catch (directErr) {
            console.warn("Direct fetch failed (CORS), retrying via local proxy...", directErr);
            const proxyUrl = `/api/proxy-document?url=${encodeURIComponent(fileSource)}`;
            const proxyRes = await fetch(proxyUrl);
            if (!proxyRes.ok) throw new Error("Proxy fetch failed: " + proxyRes.status);
            buffer = await proxyRes.arrayBuffer();
          }
        } else {
          throw new Error("Invalid document source");
        }

        if (active) {
          setArrayBuffer(buffer);
        }
      } catch (err: any) {
        if (active) {
          console.error("Error loading document:", err);
          setLoadingError(err.message || "Failed to load document");
          setLoading(false);
        }
      }
    }

    loadSource();
    return () => {
      active = false;
    };
  }, [isOpen, fileSource]);

  // Extract all text lines for in-place editing from the PDF
  const extractPageText = useCallback(async (buffer: ArrayBuffer, pageNum: number) => {
    try {
      const pdfjs = await getPdfJs();
      // Clone buffer to avoid detachment issues
      const copy = buffer.slice(0);
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(copy) });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const pw = viewport.width;
      const ph = viewport.height;

      const tc = await page.getTextContent();
      const extracted: DocumentTextLine[] = [];

      let lineIdx = 0;
      for (const item of tc.items as any[]) {
        const text = item.str;
        if (!text || text.trim() === "") continue;

        const pdfX = item.transform[4];
        const pdfY = item.transform[5];
        const fontSize =
          Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]) ||
          12;

        const topY = ph - pdfY - fontSize;
        const percentX = (pdfX / pw) * 100;
        const percentY = (topY / ph) * 100;
        const itemWidth = item.width || text.length * fontSize * 0.55;
        const percentWidth = (itemWidth / pw) * 100;
        const percentHeight = ((fontSize * 1.3) / ph) * 100;

        extracted.push({
          id: `line-${pageNum}-${lineIdx++}`,
          originalText: text,
          currentText: text,
          pageNumber: pageNum,
          pdfX,
          pdfY,
          fontSize,
          width: itemWidth,
          height: fontSize * 1.3,
          percentX: Math.max(0, Math.min(95, percentX)),
          percentY: Math.max(0, Math.min(95, percentY)),
          isModified: false,
        });
      }

      setTextLines((prev) => {
        // Keep modifications from other pages, replace current page
        const others = prev.filter((l) => l.pageNumber !== pageNum);
        return [...others, ...extracted];
      });
    } catch (err) {
      console.warn("Could not extract text lines from PDF:", err);
    }
  }, []);

  // Render current page canvas and extract text
  const renderCurrentPage = useCallback(async () => {
    if (!arrayBuffer || !canvasRef.current) return;
    setLoading(true);

    try {
      const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
      const renderWidth = isMobile
        ? Math.min(window.innerWidth - 32, 440)
        : Math.min(window.innerWidth - 60, 760);

      // Clone buffer before rendering
      const bufferCopy = arrayBuffer.slice(0);
      const result = await renderPdfPageToCanvas(
        bufferCopy,
        currentPage,
        canvasRef.current,
        renderWidth,
      );

      setTotalPages(result.totalPages);
      setPageSize({ width: result.width, height: result.height });

      // Extract text content if not already extracted for this page
      await extractPageText(arrayBuffer, currentPage);

      setLoading(false);
    } catch (err) {
      console.warn("Could not render page via PDF.js:", err);
      // Fallback A4 page
      const canvas = canvasRef.current;
      if (canvas) {
        const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
        const w = isMobile ? Math.min(window.innerWidth - 32, 380) : 650;
        const h = isMobile ? Math.round(w * 1.414) : 920;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#1e293b";
          ctx.font = "bold 16px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("Document Page " + currentPage, canvas.width / 2, 80);
          ctx.font = "12px sans-serif";
          ctx.fillStyle = "#64748b";
          ctx.fillText("Click any text to edit directly", canvas.width / 2, 110);
        }
        setPageSize({ width: w, height: h });
      }
      setLoading(false);
    }
  }, [arrayBuffer, currentPage, extractPageText]);

  useEffect(() => {
    if (arrayBuffer && isOpen) {
      renderCurrentPage();
    }
  }, [arrayBuffer, currentPage, isOpen, renderCurrentPage]);

  // Click on any text line to begin editing
  const startEditingLine = (line: DocumentTextLine) => {
    setEditingLineId(line.id);
    setEditingValue(line.currentText);
  };

  // Save the edited text line
  const saveEditingLine = () => {
    if (!editingLineId) return;
    setTextLines((prev) =>
      prev.map((l) => {
        if (l.id !== editingLineId) return l;
        return {
          ...l,
          currentText: editingValue,
          isModified: editingValue !== l.originalText,
        };
      }),
    );
    setEditingLineId(null);
  };

  // Delete a line from the document
  const deleteLine = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTextLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, isDeleted: true, isModified: true } : l)),
    );
    if (editingLineId === id) setEditingLineId(null);
  };

  // Add a new editable text line to the document
  const addNewLine = () => {
    const newId = `new-line-${currentPage}-${Date.now()}`;
    const newLine: DocumentTextLine = {
      id: newId,
      originalText: "",
      currentText: "New Detail / Note",
      pageNumber: currentPage,
      pdfX: 60,
      pdfY: 700,
      fontSize: 14,
      width: 140,
      height: 18,
      percentX: 10,
      percentY: 20 + (textLines.filter((l) => l.pageNumber === currentPage).length % 15) * 4,
      isModified: true,
    };
    setTextLines((prev) => [...prev, newLine]);
    setEditingLineId(newId);
    setEditingValue(newLine.currentText);
  };

  // Export modified PDF using vector pdf-lib
  const handleApplyAndFinish = async () => {
    if (!arrayBuffer) return;
    setSaving(true);

    try {
      const fileName = initialFileName.endsWith(".pdf")
        ? initialFileName.replace(".pdf", "_Edited.pdf")
        : `${initialFileName}_Edited.pdf`;

      // Load PDF clone into pdf-lib
      const pdfBytesCopy = arrayBuffer.slice(0);
      const pdfDoc = await PDFDocument.load(new Uint8Array(pdfBytesCopy));
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pageCount = pdfDoc.getPageCount();

      // Find all modified or deleted lines
      const modifiedLines = textLines.filter((l) => l.isModified);

      for (const line of modifiedLines) {
        if (line.pageNumber < 1 || line.pageNumber > pageCount) continue;
        const page = pdfDoc.getPage(line.pageNumber - 1);

        // 1. Erase original text area with a clean whiteout rectangle
        if (line.originalText) {
          page.drawRectangle({
            x: Math.max(0, line.pdfX - 2),
            y: Math.max(0, line.pdfY - 3),
            width: line.width + 6,
            height: line.height + 4,
            color: rgb(1, 1, 1),
          });
        }

        // 2. If not deleted, write the updated text in place
        if (!line.isDeleted && line.currentText.trim()) {
          const isBold = line.fontSize >= 16;
          page.drawText(line.currentText, {
            x: line.pdfX,
            y: line.pdfY,
            size: line.fontSize,
            font: isBold ? helveticaBold : helvetica,
            color: rgb(0, 0, 0),
          });
        }
      }

      const finalBytes = await pdfDoc.save();
      const finalFile = new File([finalBytes as Uint8Array<ArrayBuffer>], fileName, {
        type: "application/pdf",
      });

      onApply({
        file: finalFile,
        fileName: finalFile.name,
        pageCount: totalPages,
      });
      onClose();
    } catch (err: any) {
      console.error("Failed to generate modified PDF:", err);
      alert("Error saving document: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentLines = textLines.filter((l) => l.pageNumber === currentPage && !l.isDeleted);
  const modifiedCount = textLines.filter((l) => l.isModified).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-4 overflow-hidden">
      <div className="relative flex flex-col w-full h-[100dvh] sm:h-[95vh] sm:max-w-6xl rounded-none sm:rounded-2xl border-0 sm:border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 select-none">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-border px-3 sm:px-5 py-2.5 sm:py-3.5 bg-muted/40 gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer shrink-0"
              aria-label="Close editor"
            >
              <X className="size-5" />
            </button>
            <div className="min-w-0">
              <h3 className="font-display font-bold text-xs sm:text-sm text-foreground truncate flex items-center gap-2">
                <span>{initialFileName}</span>
                {modifiedCount > 0 && (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                    {modifiedCount} edited
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                Click any line or heading directly on the document to edit text.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Page navigation */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1 bg-background border border-border rounded-lg px-1.5 py-0.5 shadow-2xs">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => {
                    saveEditingLine();
                    setCurrentPage((p) => Math.max(1, p - 1));
                  }}
                  className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                  aria-label="Previous Page"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span className="text-[11px] font-semibold px-1 text-foreground font-mono">
                  {currentPage}/{totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => {
                    saveEditingLine();
                    setCurrentPage((p) => Math.min(totalPages, p + 1));
                  }}
                  className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                  aria-label="Next Page"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}

            {/* Quick add line button */}
            <Button
              size="sm"
              variant="outline"
              onClick={addNewLine}
              className="gap-1.5 text-xs h-8 px-2.5 sm:px-3 shadow-xs"
            >
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">Add Text Line</span>
              <span className="sm:hidden">Add</span>
            </Button>

            {/* Print CTA */}
            <Button
              size="sm"
              disabled={saving || loading}
              onClick={handleApplyAndFinish}
              className="gap-1.5 shadow-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Printer className="size-3.5" />}
              <span>Send to Print</span>
            </Button>
          </div>
        </div>

        {/* Inline Active Line Editing Banner (Mobile friendly) */}
        {editingLineId && (
          <div className="bg-primary/10 border-b border-primary/20 px-3 sm:px-5 py-2 flex items-center justify-between gap-2 text-xs shrink-0 animate-in fade-in-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="font-semibold text-primary shrink-0 text-xs">Edit Text:</span>
              <Input
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEditingLine();
                  if (e.key === "Escape") setEditingLineId(null);
                }}
                className="h-8 text-xs bg-background flex-1"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                onClick={saveEditingLine}
                className="h-8 text-xs px-3 bg-primary text-primary-foreground font-semibold"
              >
                <Check className="size-3.5 mr-1" /> Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingLineId(null)}
                className="h-8 text-xs px-2 text-muted-foreground"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Authentic Document Paper Viewport */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto touch-pan-x touch-pan-y bg-zinc-200 dark:bg-zinc-950 p-2 sm:p-8 flex items-start sm:items-center justify-center relative"
        >
          {loading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/70 backdrop-blur-xs gap-2">
              <Loader2 className="size-8 text-primary animate-spin" />
              <p className="text-xs font-semibold text-foreground">
                Loading authentic document page {currentPage}…
              </p>
            </div>
          )}

          {loadingError && (
            <div className="p-6 rounded-xl bg-destructive/10 text-destructive text-center max-w-md space-y-2 m-auto">
              <p className="font-semibold text-sm">Failed to open document</p>
              <p className="text-xs">{loadingError}</p>
            </div>
          )}

          {/* Real Document Sheet Container */}
          <div
            className="relative shadow-2xl rounded-sm bg-white border border-border/80 my-auto shrink-0 transition-shadow overflow-hidden"
            style={{
              width: pageSize.width,
              height: pageSize.height,
            }}
          >
            {/* The rendered document background canvas */}
            <canvas ref={canvasRef} className="absolute inset-0 block rounded-sm" />

            {/* Direct Interactive Text Layer Overlaid On The Real Document */}
            <div className="absolute inset-0 overflow-hidden">
              {currentLines.map((line) => {
                const isEditing = line.id === editingLineId;

                return (
                  <div
                    key={line.id}
                    onClick={() => startEditingLine(line)}
                    className={`group absolute rounded transition-all cursor-pointer select-text px-1 ${
                      isEditing
                        ? "bg-primary/20 ring-2 ring-primary z-20"
                        : line.isModified
                          ? "bg-emerald-500/15 ring-1 ring-emerald-500 hover:bg-emerald-500/25 z-10"
                          : "hover:bg-primary/10 hover:ring-1 hover:ring-primary/40"
                    }`}
                    style={{
                      left: `${line.percentX}%`,
                      top: `${line.percentY}%`,
                      fontSize: `${Math.max(11, Math.min(26, line.fontSize * (pageSize.width / 600)))}px`,
                      fontFamily: "sans-serif",
                      lineHeight: "1.2",
                    }}
                    title="Click to edit this text"
                  >
                    {/* If modified, show current replacement text with clean white background so original is covered */}
                    {line.isModified ? (
                      <span className="bg-white text-zinc-900 font-medium px-1 rounded-xs shadow-2xs">
                        {line.currentText}
                      </span>
                    ) : (
                      // Clean overlay matching the original text location
                      <span className="opacity-0 group-hover:opacity-40 transition-opacity text-transparent bg-primary/20">
                        {line.originalText}
                      </span>
                    )}

                    {/* Quick delete button on hover */}
                    <button
                      type="button"
                      onClick={(e) => deleteLine(line.id, e)}
                      className="hidden group-hover:inline-flex absolute -top-2.5 -right-2.5 size-4 rounded-full bg-destructive text-destructive-foreground items-center justify-center text-[9px] hover:scale-110 shadow-xs cursor-pointer"
                      title="Delete this line"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Clean Footer */}
        <div className="border-t border-border px-4 py-2.5 bg-muted/40 text-xs text-muted-foreground flex items-center justify-between shrink-0">
          <p className="flex items-center gap-1.5 text-[11px] sm:text-xs">
            <span className="font-semibold text-foreground">💡 Direct Document Editing:</span>
            Tap or click any text on the page to change it. No tools required.
          </p>
          <span className="font-mono text-[10px] hidden sm:inline">Vector Print Resolution</span>
        </div>
      </div>
    </div>
  );
}
