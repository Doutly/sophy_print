import { Check, Copy, FileText, Layers, Palette, Sparkles } from "lucide-react";
import type { PageRangeOption } from "@/lib/pdf-layout-engine";
import { Input } from "@/components/ui/input";

export interface StageColorPagesProps {
  colorMode: "bw" | "colour";
  onChangeColorMode: (mode: "bw" | "colour") => void;
  pageRangeOption: PageRangeOption;
  onChangePageRangeOption: (opt: PageRangeOption) => void;
  customRangeText: string;
  onChangeCustomRangeText: (text: string) => void;
  reversePages: boolean;
  onChangeReversePages: (rev: boolean) => void;
  copies: number;
  onChangeCopies: (copies: number) => void;
  totalPages: number;
  currentPage: number;
  bwPricePerPage: number;
  colourPricePerPage: number;
}

export function StageColorPages({
  colorMode,
  onChangeColorMode,
  pageRangeOption,
  onChangePageRangeOption,
  customRangeText,
  onChangeCustomRangeText,
  reversePages,
  onChangeReversePages,
  copies,
  onChangeCopies,
  totalPages,
  currentPage,
  bwPricePerPage,
  colourPricePerPage,
}: StageColorPagesProps) {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* 1. Color Selection Cards */}
      <section className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Palette className="size-3.5 text-primary" /> 1. Select Color Mode
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Black & White Option */}
          <button
            type="button"
            onClick={() => onChangeColorMode("bw")}
            className={`group relative flex flex-col justify-between p-4 rounded-xl border text-left transition-all cursor-pointer ${
              colorMode === "bw"
                ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="size-9 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 grid place-items-center font-bold text-xs shadow-xs">
                B&W
              </div>
              {colorMode === "bw" && (
                <span className="size-5 rounded-full bg-primary text-primary-foreground grid place-items-center">
                  <Check className="size-3 stroke-[3]" />
                </span>
              )}
            </div>

            <div className="mt-3">
              <h4 className="font-display font-bold text-sm text-foreground">Black & White (Monochrome)</h4>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                High-speed laser print via Dual Canon imageRUNNER ADVANCE 4545i III.
              </p>
            </div>

            <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">₹{bwPricePerPage.toFixed(2)} / page</span>
              <span className="text-[10px] font-mono text-emerald-600 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">
                Economy Choice
              </span>
            </div>
          </button>

          {/* Full Color Option */}
          <button
            type="button"
            onClick={() => onChangeColorMode("colour")}
            className={`group relative flex flex-col justify-between p-4 rounded-xl border text-left transition-all cursor-pointer ${
              colorMode === "colour"
                ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="size-9 rounded-lg bg-gradient-to-br from-amber-500 via-rose-500 to-indigo-600 text-white grid place-items-center font-bold text-xs shadow-xs">
                <Sparkles className="size-4" />
              </div>
              {colorMode === "colour" && (
                <span className="size-5 rounded-full bg-primary text-primary-foreground grid place-items-center">
                  <Check className="size-3 stroke-[3]" />
                </span>
              )}
            </div>

            <div className="mt-3">
              <h4 className="font-display font-bold text-sm text-foreground">Full Colour Presentation</h4>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Vibrant high-resolution output via Epson EcoTank L5290.
              </p>
            </div>

            <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">₹{colourPricePerPage.toFixed(2)} / page</span>
              <span className="text-[10px] font-mono text-indigo-600 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded">
                Photo Quality
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* 2. Page Range Selection (Matching Acrobat Print UI) */}
      <section className="space-y-3 rounded-xl border border-border bg-card/60 p-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FileText className="size-3.5 text-primary" /> 2. Page Range
          </label>
          <span className="text-xs font-medium text-muted-foreground">
            Total in Doc: <strong className="text-foreground">{totalPages} pages</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {[
            { id: "all" as PageRangeOption, label: "All Pages", desc: `1 to ${totalPages}` },
            { id: "current" as PageRangeOption, label: "Current Page", desc: `Page ${currentPage}` },
            { id: "odd" as PageRangeOption, label: "Odd Only", desc: "1, 3, 5..." },
            { id: "even" as PageRangeOption, label: "Even Only", desc: "2, 4, 6..." },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangePageRangeOption(item.id)}
              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                pageRangeOption === item.id
                  ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                  : "border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="text-xs font-bold leading-none">{item.label}</div>
              <div className="text-[10px] text-muted-foreground mt-1 opacity-80">{item.desc}</div>
            </button>
          ))}
        </div>

        {/* Custom Range Option */}
        <div className="pt-2">
          <div className="flex items-center gap-2">
            <input
              type="radio"
              id="range-custom"
              checked={pageRangeOption === "custom"}
              onChange={() => onChangePageRangeOption("custom")}
              className="text-primary focus:ring-primary size-4 cursor-pointer"
            />
            <label htmlFor="range-custom" className="text-xs font-semibold text-foreground cursor-pointer">
              Custom Range (e.g. 1-4, 7, 9-12)
            </label>
          </div>

          {pageRangeOption === "custom" && (
            <div className="mt-2 pl-6">
              <Input
                value={customRangeText}
                onChange={(e) => onChangeCustomRangeText(e.target.value)}
                placeholder="Example: 1-5, 8, 11-14"
                className="h-8.5 text-xs bg-background"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Enter comma-separated page numbers or dash ranges within 1 to {totalPages}.
              </p>
            </div>
          )}
        </div>

        {/* Reverse Pages Toggle */}
        <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
          <label htmlFor="reverse-toggle" className="flex items-center gap-2 text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              id="reverse-toggle"
              checked={reversePages}
              onChange={(e) => onChangeReversePages(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary size-3.5 cursor-pointer"
            />
            <span>Print in reverse order (from last page to first)</span>
          </label>
        </div>
      </section>

      {/* 3. Number of Copies */}
      <section className="rounded-xl border border-border bg-card/60 p-4 flex items-center justify-between">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Copy className="size-3.5 text-primary" /> 3. Number of Copies
          </label>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Full collation set for each copy.
          </p>
        </div>

        <div className="flex items-center gap-2 border border-border rounded-lg bg-background p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => onChangeCopies(Math.max(1, copies - 1))}
            disabled={copies <= 1}
            className="size-7 rounded-md grid place-items-center text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40 transition-colors cursor-pointer text-xs font-bold"
          >
            -
          </button>
          <span className="font-mono text-xs font-bold px-2 min-w-8 text-center text-foreground">
            {copies}
          </span>
          <button
            type="button"
            onClick={() => onChangeCopies(Math.min(50, copies + 1))}
            disabled={copies >= 50}
            className="size-7 rounded-md grid place-items-center text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40 transition-colors cursor-pointer text-xs font-bold"
          >
            +
          </button>
        </div>
      </section>
    </div>
  );
}
