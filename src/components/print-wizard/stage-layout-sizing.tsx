import {
  AlignHorizontalDistributeCenter,
  BookOpen,
  Grid,
  Layers,
  Maximize2,
  Minimize2,
  RotateCw,
  Sliders,
} from "lucide-react";
import type {
  DuplexMode,
  OrientationMode,
  PagesPerSheetMode,
  PageSizingMode,
  PaperSizeMode,
} from "@/lib/pdf-layout-engine";

export interface StageLayoutSizingProps {
  orientation: OrientationMode;
  onChangeOrientation: (o: OrientationMode) => void;
  pagesPerSheet: PagesPerSheetMode;
  onChangePagesPerSheet: (n: PagesPerSheetMode) => void;
  pageSizing: PageSizingMode;
  onChangePageSizing: (s: PageSizingMode) => void;
  customScalePercent: number;
  onChangeCustomScalePercent: (p: number) => void;
  duplex: DuplexMode;
  onChangeDuplex: (d: DuplexMode) => void;
  paperSize: PaperSizeMode;
  onChangePaperSize: (ps: PaperSizeMode) => void;
  autoCenter: boolean;
  onChangeAutoCenter: (c: boolean) => void;
  autoRotate: boolean;
  onChangeAutoRotate: (r: boolean) => void;
}

export function StageLayoutSizing({
  orientation,
  onChangeOrientation,
  pagesPerSheet,
  onChangePagesPerSheet,
  pageSizing,
  onChangePageSizing,
  customScalePercent,
  onChangeCustomScalePercent,
  duplex,
  onChangeDuplex,
  paperSize,
  onChangePaperSize,
  autoCenter,
  onChangeAutoCenter,
  autoRotate,
  onChangeAutoRotate,
}: StageLayoutSizingProps) {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* 1. Page Setup & Orientation */}
      <section className="rounded-xl border border-border bg-card/60 p-4 space-y-3.5">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <RotateCw className="size-3.5 text-primary" /> 1. Page Setup & Orientation
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Paper Size Selector */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Paper Size</label>
            <select
              value={paperSize}
              onChange={(e) => onChangePaperSize(e.target.value as PaperSizeMode)}
              className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden cursor-pointer"
            >
              <option value="A4">A4 (210 x 297 mm) — Standard Xerox</option>
              <option value="Letter">Letter (8.5 x 11 in)</option>
              <option value="Legal">Legal (8.5 x 14 in)</option>
            </select>
          </div>

          {/* Orientation Toggle */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Orientation</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChangeOrientation("portrait")}
                className={`h-9 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  orientation === "portrait"
                    ? "border-primary bg-primary/10 text-primary shadow-2xs"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="w-3.5 h-4.5 border-2 border-current rounded-xs" />
                <span>Portrait</span>
              </button>

              <button
                type="button"
                onClick={() => onChangeOrientation("landscape")}
                className={`h-9 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  orientation === "landscape"
                    ? "border-primary bg-primary/10 text-primary shadow-2xs"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="w-4.5 h-3.5 border-2 border-current rounded-xs" />
                <span>Landscape</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Multiple Pages per Sheet (N-Up / 2x2) */}
      <section className="rounded-xl border border-border bg-card/60 p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Grid className="size-3.5 text-primary" /> 2. Multiple Pages per Sheet (N-Up)
          </label>
          <span className="text-[10px] font-mono text-emerald-600 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">
            Eco Paper Saver
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1 on 1 */}
          <button
            type="button"
            onClick={() => onChangePagesPerSheet(1)}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              pagesPerSheet === 1
                ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-2xs"
                : "border-border bg-background hover:bg-muted/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">1 on 1 Sheet</span>
              <div className="size-6 border border-border bg-muted rounded grid place-items-center text-[10px] font-bold">
                1
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Standard 1 page per sheet. Standard readability.
            </p>
          </button>

          {/* 2 on 1 */}
          <button
            type="button"
            onClick={() => onChangePagesPerSheet(2)}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              pagesPerSheet === 2
                ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-2xs"
                : "border-border bg-background hover:bg-muted/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">2 on 1 Sheet</span>
              <div className="flex gap-0.5 border border-border bg-muted p-0.5 rounded">
                <span className="size-4 bg-background rounded-xs text-[8px] font-bold grid place-items-center">
                  1
                </span>
                <span className="size-4 bg-background rounded-xs text-[8px] font-bold grid place-items-center">
                  2
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Side-by-side 2 pages per sheet. Saves 50% paper cost!
            </p>
          </button>

          {/* 4 on 1 (2x2 Grid) */}
          <button
            type="button"
            onClick={() => onChangePagesPerSheet(4)}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              pagesPerSheet === 4
                ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-2xs"
                : "border-border bg-background hover:bg-muted/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">2x2 (4 on 1)</span>
              <div className="grid grid-cols-2 gap-0.5 border border-border bg-muted p-0.5 rounded">
                <span className="size-3.5 bg-background rounded-2xs text-[7px] font-bold grid place-items-center">
                  1
                </span>
                <span className="size-3.5 bg-background rounded-2xs text-[7px] font-bold grid place-items-center">
                  2
                </span>
                <span className="size-3.5 bg-background rounded-2xs text-[7px] font-bold grid place-items-center">
                  3
                </span>
                <span className="size-3.5 bg-background rounded-2xs text-[7px] font-bold grid place-items-center">
                  4
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              2x2 four-page grid on 1 sheet. Maximum paper savings!
            </p>
          </button>
        </div>
      </section>

      {/* 3. Page Sizing & Handling */}
      <section className="rounded-xl border border-border bg-card/60 p-4 space-y-3.5">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Maximize2 className="size-3.5 text-primary" /> 3. Page Sizing & Margin Handling
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            {
              id: "fit" as PageSizingMode,
              label: "Fit for printing margins",
              desc: "Scales page safely inside standard margins",
            },
            {
              id: "actual" as PageSizingMode,
              label: "Actual Size (100%)",
              desc: "1:1 scale original dimensions",
            },
            {
              id: "scale" as PageSizingMode,
              label: "Custom Scale %",
              desc: `${customScalePercent}% zoom scaling`,
            },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChangePageSizing(mode.id)}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                pageSizing === mode.id
                  ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="text-xs font-bold">{mode.label}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{mode.desc}</div>
            </button>
          ))}
        </div>

        {pageSizing === "scale" && (
          <div className="pt-2 flex items-center gap-3">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Scale Value:</span>
            <input
              type="range"
              min="50"
              max="150"
              step="5"
              value={customScalePercent}
              onChange={(e) => onChangeCustomScalePercent(parseInt(e.target.value, 10))}
              className="flex-1 accent-primary cursor-pointer"
            />
            <span className="font-mono text-xs font-bold min-w-12 text-foreground">
              {customScalePercent}%
            </span>
          </div>
        )}
      </section>

      {/* 4. Double-Sided Duplex Printing */}
      <section className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <BookOpen className="size-3.5 text-primary" /> 4. Double-Sided (Duplex) Printing
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => onChangeDuplex("single")}
            className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
              duplex === "single"
                ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className="text-xs font-bold">Single-Sided</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Front side only</div>
          </button>

          <button
            type="button"
            onClick={() => onChangeDuplex("duplex-long")}
            className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
              duplex === "duplex-long"
                ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className="text-xs font-bold">Double-Sided (Long Edge)</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Booklet / Standard flip</div>
          </button>

          <button
            type="button"
            onClick={() => onChangeDuplex("duplex-short")}
            className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
              duplex === "duplex-short"
                ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className="text-xs font-bold">Double-Sided (Short Edge)</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Notepad / Calendar flip</div>
          </button>
        </div>
      </section>

      {/* 5. Content Settings */}
      <section className="pt-2 flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoCenter}
            onChange={(e) => onChangeAutoCenter(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary size-3.5 cursor-pointer"
          />
          <span className="flex items-center gap-1 font-medium text-foreground">
            <AlignHorizontalDistributeCenter className="size-3 text-primary" /> Auto Center on Sheet
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoRotate}
            onChange={(e) => onChangeAutoRotate(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary size-3.5 cursor-pointer"
          />
          <span className="flex items-center gap-1 font-medium text-foreground">
            <RotateCw className="size-3 text-primary" /> Auto Rotate to Fit
          </span>
        </label>
      </section>
    </div>
  );
}
