import { useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileText,
  Layers,
  Loader2,
  Palette,
  Printer,
  Sliders,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PRINT_LAYOUT_CONFIG,
  computeSheetMetrics,
  resolvePageIndices,
  transformPdfLayout,
  type DuplexMode,
  type OrientationMode,
  type PageRangeOption,
  type PageSizingMode,
  type PagesPerSheetMode,
  type PaperSizeMode,
  type PrintLayoutConfig,
} from "@/lib/pdf-layout-engine";
import { StageColorPages } from "./stage-color-pages";
import { StageLayoutSizing } from "./stage-layout-sizing";
import { StageSheetPreview } from "./stage-sheet-preview";
import type { PricingConfig } from "@/lib/print-data";

export interface PrintWizardModalProps {
  file: File | null;
  sourceArrayBuffer: ArrayBuffer | null;
  fileName: string;
  totalPages: number;
  isOpen: boolean;
  onClose: () => void;
  pricingConfig: PricingConfig;
  onConfirmPrint: (result: {
    transformedFile: File;
    config: PrintLayoutConfig;
    physicalSheets: number;
    selectedPages: number;
    colorMode: "bw" | "colour";
    copies: number;
    totalAmount: number;
    studentName: string;
    studentPhone: string;
  }) => Promise<void>;
}

export function PrintWizardModal({
  file,
  sourceArrayBuffer,
  fileName,
  totalPages,
  isOpen,
  onClose,
  pricingConfig,
  onConfirmPrint,
}: PrintWizardModalProps) {
  // Wizard Stage: 1 = Color & Pages, 2 = Layout & Sizing, 3 = Preview & Pay
  const [currentStage, setCurrentStage] = useState<1 | 2 | 3>(1);

  // Configuration State
  const [colorMode, setColorMode] = useState<"bw" | "colour">("bw");
  const [copies, setCopies] = useState<number>(1);
  const [pageRangeOption, setPageRangeOption] = useState<PageRangeOption>("all");
  const [customRangeText, setCustomRangeText] = useState<string>("1");
  const [reversePages, setReversePages] = useState<boolean>(false);

  const [orientation, setOrientation] = useState<OrientationMode>("portrait");
  const [pagesPerSheet, setPagesPerSheet] = useState<PagesPerSheetMode>(1);
  const [pageSizing, setPageSizing] = useState<PageSizingMode>("fit");
  const [customScalePercent, setCustomScalePercent] = useState<number>(100);
  const [duplex, setDuplex] = useState<DuplexMode>("single");
  const [paperSize, setPaperSize] = useState<PaperSizeMode>("A4");
  const [autoCenter, setAutoCenter] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  // Student Identity
  const [studentName, setStudentName] = useState("");
  const [studentPhone, setStudentPhone] = useState("");

  // Transformed PDF bytes for preview and submission
  const [transformedBytes, setTransformedBytes] = useState<Uint8Array | null>(null);
  const [transforming, setTransforming] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Reset to stage 1 when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStage(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Selected pages count
  const selectedIndices = resolvePageIndices(
    totalPages || 1,
    pageRangeOption,
    customRangeText,
    1,
    reversePages,
  );
  const selectedPageCount = selectedIndices.length;

  // Physical sheets metrics
  const sheetMetrics = computeSheetMetrics(selectedPageCount, pagesPerSheet, duplex);
  const physicalSheets = sheetMetrics.physicalSheets;

  // Pricing calculation
  const isDouble = duplex !== "single";
  const unitRate =
    colorMode === "colour"
      ? (isDouble ? pricingConfig.colourDouble : pricingConfig.colourSingle)
      : (isDouble ? pricingConfig.bwDouble : pricingConfig.bwSingle);
  const totalPrice = physicalSheets * copies * unitRate;

  const currentLayoutConfig: PrintLayoutConfig = {
    orientation,
    pagesPerSheet,
    pageSizing,
    customScalePercent,
    duplex,
    paperSize,
    pageRangeOption,
    customRangeText,
    currentPageNumber: 1,
    reversePages,
    autoCenter,
    autoRotate,
    printContentMode: "document",
  };

  // Move from Stage 2 to Stage 3: run layout transformation
  const handleProceedToPreview = async () => {
    if (!sourceArrayBuffer) return;
    setTransforming(true);

    try {
      const bufferCopy = sourceArrayBuffer.slice(0);
      const result = await transformPdfLayout(bufferCopy, currentLayoutConfig, fileName);
      setTransformedBytes(result.transformedBytes);
      setCurrentStage(3);
    } catch (err: any) {
      console.error("Failed to generate transformed PDF:", err);
      alert("Could not compose print layout: " + (err.message || "Unknown error"));
    } finally {
      setTransforming(false);
    }
  };

  // Final confirmation & payment submit
  const handleFinalSubmit = async () => {
    if (!transformedBytes) return;
    setSubmitting(true);

    try {
      const bytesCopy = new Uint8Array(transformedBytes.slice());
      const transformedFile = new File(
        [bytesCopy as Uint8Array<ArrayBuffer>],
        `${fileName.replace(/\.pdf$/i, "")}_spool.pdf`,
        { type: "application/pdf" },
      );

      await onConfirmPrint({
        transformedFile,
        config: currentLayoutConfig,
        physicalSheets,
        selectedPages: selectedPageCount,
        colorMode,
        copies,
        totalAmount: totalPrice,
        studentName,
        studentPhone,
      });
      onClose();
    } catch (err: any) {
      console.error("Submission error:", err);
      alert("Submission error: " + (err.message || "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="relative flex flex-col w-full max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[92vh] rounded-none sm:rounded-2xl border-0 sm:border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95">
        {/* Top Header & Wizard Stepper */}
        <header className="border-b border-border bg-muted/40 px-3.5 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="grid size-9 sm:size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-xs shrink-0">
              <Printer className="size-4 sm:size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-sm sm:text-base text-foreground flex items-center gap-1.5 sm:gap-2 truncate">
                Print Customizer Studio
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-emerald-600 uppercase">
                  Acrobat Standard
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate max-w-xs sm:max-w-md">
                {fileName} ({totalPages} pages)
              </p>
            </div>
          </div>

          {/* Stepper Indicator - Clickable navigation */}
          <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2.5 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {[
                { num: 1, label: "Color & Pages", icon: Palette },
                { num: 2, label: "Layout & Sizing", icon: Sliders },
                { num: 3, label: "Preview & Pay", icon: Eye },
              ].map((step, idx) => {
                const Icon = step.icon;
                const isActive = currentStage === step.num;
                const isPast = currentStage > step.num;
                const canNavigate = step.num <= currentStage || (step.num === 2 && currentStage === 3) || (step.num === 1);

                return (
                  <div key={step.num} className="flex items-center gap-1 sm:gap-2">
                    <button
                      type="button"
                      disabled={!canNavigate}
                      onClick={() => {
                        if (canNavigate) {
                          setCurrentStage(step.num as 1 | 2 | 3);
                        }
                      }}
                      className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : isPast
                            ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 cursor-pointer"
                            : "bg-muted text-muted-foreground opacity-60"
                      } ${canNavigate ? "cursor-pointer" : "cursor-default"}`}
                      title={`Go to ${step.label}`}
                    >
                      {isPast ? <Check className="size-3 sm:size-3.5" /> : <Icon className="size-3 sm:size-3.5" />}
                      <span className="hidden md:inline">{step.label}</span>
                      <span className="md:hidden">Step {step.num}</span>
                    </button>
                    {idx < 2 && <ChevronRight className="size-3 sm:size-3.5 text-muted-foreground/50 shrink-0" />}
                  </div>
                );
              })}
            </div>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer shrink-0 ml-1"
              aria-label="Close dialog"
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        {/* Wizard Step Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {currentStage === 1 && (
            <StageColorPages
              colorMode={colorMode}
              onChangeColorMode={setColorMode}
              pageRangeOption={pageRangeOption}
              onChangePageRangeOption={setPageRangeOption}
              customRangeText={customRangeText}
              onChangeCustomRangeText={setCustomRangeText}
              reversePages={reversePages}
              onChangeReversePages={setReversePages}
              copies={copies}
              onChangeCopies={setCopies}
              totalPages={totalPages}
              currentPage={1}
              bwPricePerPage={pricingConfig.bwSingle}
              colourPricePerPage={pricingConfig.colourSingle}
            />
          )}

          {currentStage === 2 && (
            <StageLayoutSizing
              orientation={orientation}
              onChangeOrientation={setOrientation}
              pagesPerSheet={pagesPerSheet}
              onChangePagesPerSheet={setPagesPerSheet}
              pageSizing={pageSizing}
              onChangePageSizing={setPageSizing}
              customScalePercent={customScalePercent}
              onChangeCustomScalePercent={setCustomScalePercent}
              duplex={duplex}
              onChangeDuplex={setDuplex}
              paperSize={paperSize}
              onChangePaperSize={setPaperSize}
              autoCenter={autoCenter}
              onChangeAutoCenter={setAutoCenter}
              autoRotate={autoRotate}
              onChangeAutoRotate={setAutoRotate}
            />
          )}

          {currentStage === 3 && (
            <StageSheetPreview
              transformedPdfBytes={transformedBytes}
              fileName={fileName}
              config={currentLayoutConfig}
              selectedPageCount={selectedPageCount}
              totalPhysicalSheets={physicalSheets}
              copies={copies}
              colorMode={colorMode}
              unitPrice={unitRate}
              totalPrice={totalPrice}
              studentName={studentName}
              onChangeStudentName={setStudentName}
              studentPhone={studentPhone}
              onChangeStudentPhone={setStudentPhone}
              isSubmitting={submitting}
              onConfirmAndPay={handleFinalSubmit}
              onBackToLayout={() => setCurrentStage(2)}
            />
          )}
        </div>

        {/* Wizard Bottom Navigation Bar (Stages 1 and 2) */}
        {currentStage < 3 && (
          <footer className="border-t border-border bg-muted/20 px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0">
            <div>
              {currentStage > 1 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStage((s) => (s - 1) as 1 | 2)}
                  className="gap-1.5 text-xs shadow-2xs cursor-pointer"
                >
                  <ArrowLeft className="size-3.5" /> Back
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  Select color & pages to configure orientation & multi-page sheets.
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {currentStage === 1 && (
                <Button
                  size="sm"
                  onClick={() => setCurrentStage(2)}
                  className="gap-1.5 text-xs font-semibold shadow-xs bg-primary text-primary-foreground cursor-pointer px-4"
                >
                  <span>Next: Layout & Sizing</span>
                  <ArrowRight className="size-3.5" />
                </Button>
              )}

              {currentStage === 2 && (
                <Button
                  size="sm"
                  disabled={transforming}
                  onClick={handleProceedToPreview}
                  className="gap-1.5 text-xs font-semibold shadow-xs bg-primary text-primary-foreground cursor-pointer px-4"
                >
                  {transforming ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Composing Layout...</span>
                    </>
                  ) : (
                    <>
                      <span>Next: Live Sheet Preview</span>
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
