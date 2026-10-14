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
}: StageSheetPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentSheet, setCurrentSheet] = useState(1);
  const [totalSheets, setTotalSheets] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Render sheet preview on canvas via pdfjs-dist
  useEffect(() => {
    if (!transformedPdfBytes || transformedPdfBytes.length === 0) return;

    let isCancelled = false;
    setLoadingPreview(true);
    setPreviewError(null);

    async function renderPage() {
      try {
        const loadingTask = pdfjsLib.getDocument({
          data: transformedPdfBytes!,
          cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/",
          cMapPacked: true,
        });

        const pdf = await loadingTask.promise;
        if (isCancelled) return;

        setTotalSheets(pdf.numPages);
        const safePageNum = Math.min(Math.max(1, currentSheet), pdf.numPages);
        const page = await pdf.getPage(safePageNum);
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

        await page.render(renderContext as any).promise;
        if (!isCancelled) {
          setLoadingPreview(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error("Failed to render PDF preview canvas:", err);
          setPreviewError("Could not render sheet preview: " + err.message);
          setLoadingPreview(false);
        }
      }
    }

    renderPage();

    return () => {
      isCancelled = true;
    };
  }, [transformedPdfBytes, currentSheet, zoom]);

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
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground">Print Output Preview</span>
              <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border border-border">
                {config.orientation === "landscape" ? "Landscape Sheet" : "Portrait Sheet"}
              </span>
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
          <div className="flex items-center justify-between border-t border-border/80 pt-2.5">
            <span className="text-xs text-muted-foreground">
              Physical Paper Sheet{" "}
              <strong className="text-foreground">
                {currentSheet} of {totalSheets}
              </strong>
            </span>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={currentSheet <= 1}
                onClick={() => setCurrentSheet((s) => Math.max(1, s - 1))}
                className="h-7 text-xs px-2.5 gap-1 shadow-2xs"
              >
                <ChevronLeft className="size-3.5" /> Prev Sheet
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={currentSheet >= totalSheets}
                onClick={() => setCurrentSheet((s) => Math.min(totalSheets, s + 1))}
                className="h-7 text-xs px-2.5 gap-1 shadow-2xs"
              >
                Next Sheet <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm & Pay Call to Action */}
      <div className="pt-2 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-emerald-600" />
          <span>Spools directly to shop PC via 24/7 background gateway. Instant 4-digit pickup code.</span>
        </div>

        <Button
          size="lg"
          onClick={onConfirmAndPay}
          disabled={isSubmitting || loadingPreview}
          className="w-full sm:w-auto gap-2 font-display font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white min-w-56"
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
  );
}
