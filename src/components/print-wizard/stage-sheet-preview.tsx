import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Info,
  Layers,
  Loader2,
  Printer,
  ShieldCheck,
  Sparkles,
  User,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import type { PrintLayoutConfig } from "@/lib/pdf-layout-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Ensure worker is configured for pdfjs-dist
if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export interface StageSheetPreviewProps {
  transformedPdfBytes: Uint8Array | null;
  fileName: string;
  config: PrintLayoutConfig;
  selectedPageCount: number;
  totalPhysicalSheets: number;
  copies: number;
  colorMode: "bw" | "colour";
  unitPrice: number;
  totalPrice: number;
  studentName: string;
  onChangeStudentName: (name: string) => void;
  studentPhone: string;
  onChangeStudentPhone: (phone: string) => void;
  isSubmitting: boolean;
  onConfirmAndPay: () => void;
  onBackToLayout: () => void;
}

export function StageSheetPreview({
  transformedPdfBytes,
  fileName,
  config,
  selectedPageCount,
  totalPhysicalSheets,
  copies,
  colorMode,
  unitPrice,
  totalPrice,
  studentName,
  onChangeStudentName,
  studentPhone,
  onChangeStudentPhone,
  isSubmitting,
  onConfirmAndPay,
  onBackToLayout,
}: StageSheetPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentSheet, setCurrentSheet] = useState(1);
  const [currentSide, setCurrentSide] = useState<"front" | "back">("front");
  const [zoom, setZoom] = useState(1.0);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const renderTaskRef = useRef<any>(null);

  const isDuplex = config.duplex !== "single";
  const numPagesInTransformed = pdfDoc?.numPages || 1;
  const computedTotalSheets = isDuplex
    ? Math.max(1, Math.ceil(numPagesInTransformed / 2))
    : Math.max(1, numPagesInTransformed);

  // 1. Load the PDF Document once whenever transformedPdfBytes changes
  useEffect(() => {
    if (!transformedPdfBytes || transformedPdfBytes.length === 0) return;

    let isCancelled = false;
    setLoadingPreview(true);
    setPreviewError(null);

    // ALWAYS create a clone of the byte array so that pdf.js worker never detaches the original
    const byteClone = new Uint8Array(transformedPdfBytes.slice());

    const loadingTask = pdfjsLib.getDocument({
      data: byteClone,
      cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/",
      cMapPacked: true,
    });

    loadingTask.promise
      .then((loadedDoc) => {
        if (isCancelled) {
          try {
            loadedDoc.destroy();
          } catch {}
          return;
        }
        setPdfDoc(loadedDoc);
        setCurrentSheet(1);
        setCurrentSide("front");
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Failed to parse transformed PDF:", err);
          setPreviewError("Could not load sheet preview: " + (err.message || String(err)));
          setLoadingPreview(false);
        }
      });

    return () => {
      isCancelled = true;
      try {
        loadingTask.destroy();
      } catch {}
    };
  }, [transformedPdfBytes]);

  // 2. Render sheet on canvas whenever pdfDoc, currentSheet, currentSide, or zoom changes
  useEffect(() => {
    if (!pdfDoc) return;

    let isCancelled = false;
    setLoadingPreview(true);
    setPreviewError(null);

    async function renderPage() {
      try {
        // Cancel any pending render task to avoid multiple simultaneous renders on the same canvas
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {}
          renderTaskRef.current = null;
        }

        // Determine which face of the transformed PDF to display
        const targetFace = isDuplex
          ? currentSide === "front"
            ? (currentSheet - 1) * 2 + 1
            : (currentSheet - 1) * 2 + 2
          : currentSheet;

        // If targetFace exceeds the document's total pages, this is a blank back side
        if (targetFace > pdfDoc.numPages) {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const context = canvas.getContext("2d");
          if (!context) return;

          let w = 595 * 1.2 * zoom;
          let h = 842 * 1.2 * zoom;
          try {
            const p1 = await pdfDoc.getPage(1);
            const vp1 = p1.getViewport({ scale: 1.2 * zoom });
            w = vp1.width;
            h = vp1.height;
          } catch {}

          canvas.width = w;
          canvas.height = h;

          // Clear & fill white paper
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, w, h);

          // Subtle dashed border
          context.save();
          context.strokeStyle = "#e2e8f0";
          context.lineWidth = 2;
          context.setLineDash([8, 8]);
          context.strokeRect(24, 24, w - 48, h - 48);
          context.restore();

          // Draw friendly indicator
          context.fillStyle = "#64748b";
          context.font = "bold 16px system-ui, -apple-system, sans-serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText("Blank Back Side", w / 2, h / 2 - 14);

          context.font = "12px system-ui, -apple-system, sans-serif";
          context.fillStyle = "#94a3b8";
          context.fillText("End of Document — No content printed on this side", w / 2, h / 2 + 14);

          if (!isCancelled) {
            setLoadingPreview(false);
          }
          return;
        }

        const safePageNum = Math.min(Math.max(1, targetFace), pdfDoc.numPages);
        const page = await pdfDoc.getPage(safePageNum);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: 1.2 * zoom });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        };

        const renderTask = page.render(renderContext as any);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        if (!isCancelled) {
          setLoadingPreview(false);
        }
      } catch (err: any) {
        if (err?.name === "RenderingCancelledException") {
          return;
        }
        if (!isCancelled) {
          console.error("Failed to render PDF preview canvas:", err);
          setPreviewError("Could not render sheet preview: " + (err.message || String(err)));
          setLoadingPreview(false);
        }
      }
    }

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, currentSheet, currentSide, zoom, isDuplex]);

  const machineName =
    colorMode === "bw" ? "Canon imageRUNNER ADVANCE 4545i III (LAN)" : "Epson EcoTank L5290 (Colour)";

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Job Specifications & Pricing Summary */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="size-3.5 text-primary" /> Print Specifications
              </span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {colorMode === "bw" ? "B&W Monochrome" : "Full Colour"}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Document File:</span>
                <span className="font-semibold text-foreground truncate max-w-48" title={fileName}>
                  {fileName}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Original Pages Selected:</span>
                <span className="font-semibold text-foreground">{selectedPageCount} pages</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Multi-Page per Sheet:</span>
                <span className="font-semibold text-foreground">
                  {config.pagesPerSheet === 1
                    ? "1 on 1 (Full Size)"
                    : config.pagesPerSheet === 2
                      ? "2 on 1 (Side-by-side)"
                      : "2x2 (4 on 1 Grid)"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Orientation & Size:</span>
                <span className="font-semibold text-foreground capitalize">
                  {config.orientation} · {config.paperSize}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Duplex Mode:</span>
                <span className="font-semibold text-foreground">
                  {config.duplex === "single" ? "Single-Sided" : "Double-Sided (Duplex)"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Print Driver & Machine:</span>
                <span className="font-semibold text-foreground truncate max-w-40" title={machineName}>
                  {machineName}
                </span>
              </div>
            </div>

            {/* Savings & Sheet Count Highlight Card */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <Sparkles className="size-3.5" /> Physical Sheets Used:
                </span>
                <span className="font-mono text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                  {totalPhysicalSheets} Sheet{totalPhysicalSheets > 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                You are billed for physical paper sheets, saving cost compared to normal page rates!
              </p>
            </div>

            {/* Total Pricing Box */}
            <div className="pt-3 border-t border-border flex items-baseline justify-between">
              <div>
                <span className="text-xs text-muted-foreground block">
                  Total Bill ({copies} copy x {totalPhysicalSheets} sheets @ ₹{unitPrice.toFixed(2)}):
                </span>
                <span className="text-[10px] text-muted-foreground">Includes all paper & Xerox costs</span>
              </div>
              <span className="font-display font-extrabold text-2xl text-primary">
                ₹{totalPrice.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Student Pickup Contact Inputs */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="size-3.5 text-primary" /> Pickup Details (Optional)
            </span>

            <div className="space-y-2">
              <Input
                placeholder="Student Name (e.g. Rahul Sharma)"
                value={studentName}
                onChange={(e) => onChangeStudentName(e.target.value)}
                className="h-8.5 text-xs bg-background"
              />
              <Input
                placeholder="Mobile Number (e.g. 9876543210)"
                value={studentPhone}
                onChange={(e) => onChangeStudentPhone(e.target.value)}
                className="h-8.5 text-xs bg-background"
              />
            </div>
          </div>
        </div>

        {/* Right: Live Interactive Paper Preview (Acrobat style) */}
        <div className="lg:col-span-7 flex flex-col rounded-xl border border-border bg-zinc-100 dark:bg-zinc-900/70 p-4 space-y-3 shadow-xs min-h-[480px]">
          {/* Preview Toolbar */}
          <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-foreground">Print Output Preview</span>
              <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border border-border">
                {config.orientation === "landscape" ? "Landscape Sheet" : "Portrait Sheet"}
              </span>
              {isDuplex && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-primary border border-primary/20">
                  {currentSide === "front" ? "Front Side" : "Back Side"}
                  {pdfDoc && ` · Face ${currentSide === "front" ? (currentSheet - 1) * 2 + 1 : (currentSheet - 1) * 2 + 2} of ${pdfDoc.numPages}`}
                </span>
              )}
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
                className="size-7 rounded-md border border-border bg-background grid place-items-center text-muted-foreground hover:text-foreground cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="size-3.5" />
              </button>
              <span className="text-[11px] font-mono min-w-10 text-center text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.0, z + 0.15))}
                className="size-7 rounded-md border border-border bg-background grid place-items-center text-muted-foreground hover:text-foreground cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Canvas Viewing Area */}
          <div className="relative flex-1 flex items-center justify-center p-3 overflow-auto min-h-[380px]">
            {loadingPreview && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/60 backdrop-blur-2xs gap-2">
                <Loader2 className="size-6 text-primary animate-spin" />
                <span className="text-xs font-semibold text-muted-foreground">
                  Composing print sheet preview...
                </span>
              </div>
            )}

            {previewError ? (
              <div className="text-center p-6 space-y-2">
                <AlertCircle className="size-8 text-destructive mx-auto" />
                <p className="text-xs text-destructive font-medium">{previewError}</p>
              </div>
            ) : (
              <div className="relative transition-transform duration-200 shadow-2xl rounded-sm border border-zinc-300 dark:border-zinc-700 bg-white">
                <canvas ref={canvasRef} className="block rounded-xs max-h-[460px] w-auto" />
              </div>
            )}
          </div>

          {/* Sheet Navigation Controls (e.g. < Sheet 1 of 4 >) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-border/80 pt-2.5 gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">
                Physical Paper Sheet{" "}
                <strong className="text-foreground">
                  {currentSheet} of {computedTotalSheets}
                </strong>
              </span>

              {isDuplex && (
                <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-xs font-medium shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setCurrentSide("front")}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      currentSide === "front"
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Front Side {pdfDoc && `(#${(currentSheet - 1) * 2 + 1})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentSide("back")}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      currentSide === "back"
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Back Side {pdfDoc && ((currentSheet - 1) * 2 + 2 <= pdfDoc.numPages ? `(#${(currentSheet - 1) * 2 + 2})` : "(Blank)")}
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <Button
                size="sm"
                variant="outline"
                disabled={currentSheet <= 1}
                onClick={() => {
                  setCurrentSheet((s) => Math.max(1, s - 1));
                  setCurrentSide("front");
                }}
                className="h-7 text-xs px-2.5 gap-1 shadow-2xs cursor-pointer"
              >
                <ChevronLeft className="size-3.5" /> Prev Sheet
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={currentSheet >= computedTotalSheets}
                onClick={() => {
                  setCurrentSheet((s) => Math.min(computedTotalSheets, s + 1));
                  setCurrentSide("front");
                }}
                className="h-7 text-xs px-2.5 gap-1 shadow-2xs cursor-pointer"
              >
                Next Sheet <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Actions: Back to Step 2 and Submit & Pay */}
      <div className="pt-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground w-full sm:w-auto">
          <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
          <span className="text-[11px] sm:text-xs">
            Spools directly to shop PC via 24/7 background gateway. Instant 4-digit pickup code.
          </span>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-center gap-2.5 w-full sm:w-auto">
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={onBackToLayout}
            disabled={isSubmitting}
            className="w-full sm:w-auto gap-2 font-display font-semibold text-xs border-border hover:bg-secondary cursor-pointer"
          >
            <ChevronLeft className="size-4" />
            <span>Back to Step 2: Layout & Sizing</span>
          </Button>

          <Button
            size="lg"
            onClick={onConfirmAndPay}
            disabled={isSubmitting || loadingPreview}
            className="w-full sm:w-auto gap-2 font-display font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white min-w-56 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Transmitting Order...</span>
              </>
            ) : (
              <>
                <Printer className="size-4.5" />
                <span>Submit & Print — ₹{totalPrice.toFixed(2)}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
