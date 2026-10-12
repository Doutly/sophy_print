import { createFileRoute } from "@tanstack/react-router";
import { Check, DollarSign, HelpCircle, Layers, Printer, RefreshCw, RotateCcw, Save, Sparkles } from "lucide-react";
import { useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  defaultPricingConfig,
  getPricingConfig,
  savePricingConfig,
  calculateJobPrice,
  type PricingConfig,
} from "@/lib/print-data";

export const Route = createFileRoute("/admin/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing Management — Sophy Print" },
      { name: "description", content: "Configure print rates and pricing rules for campus printing." },
      { property: "og:title", content: "Pricing Management — Sophy Print" },
      { property: "og:description", content: "Campus print rates, sheet pricing, and machine fees." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const [pricing, setPricing] = useState<PricingConfig>(() => getPricingConfig());
  const [savedNotice, setSavedNotice] = useState(false);

  // Simulator test inputs
  const [simPages, setSimPages] = useState(18);
  const [simCopies, setSimCopies] = useState(1);
  const [simMode, setSimMode] = useState<"bw" | "colour">("bw");
  const [simSides, setSimSides] = useState<"single" | "double">("single");
  const [simPaper, setSimPaper] = useState<"A4" | "A3">("A4");

  const simulated = calculateJobPrice(simPages, simCopies, simMode, simSides, simPaper, pricing);

  const handleRateChange = (field: keyof PricingConfig, val: string) => {
    const num = parseFloat(val);
    setPricing((prev) => ({
      ...prev,
      [field]: isNaN(num) || num < 0 ? 0 : num,
    }));
  };

  const handleSave = () => {
    savePricingConfig(pricing);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleReset = () => {
    setPricing(defaultPricingConfig);
    savePricingConfig(defaultPricingConfig);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <AdminShell
      title="Pricing Management"
      eyebrow="Active Print Tariffs"
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="size-3.5" />
            Reset Defaults
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1.5 shadow-xs">
            {savedNotice ? <Check className="size-3.5" /> : <Save className="size-3.5" />}
            {savedNotice ? "Saved to Cloud" : "Save Changes"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Intro Banner */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Campus Rate Schedule</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Rates apply automatically to all upcoming student submissions. Existing paid orders retain their locked order rate.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" />
            Auto-synced with Firebase
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Pricing Config Form */}
          <div className="space-y-6 lg:col-span-7">
            {/* Black & White Rates */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
              <div className="flex items-center gap-2.5 pb-4 border-b border-border">
                <span className="grid size-8 place-items-center rounded-lg bg-secondary text-foreground">
                  <Printer className="size-4" />
                </span>
                <div>
                  <h3 className="font-display font-semibold text-foreground">Black & White (Dual Canon imageRUNNER ADVANCE 4545i III)</h3>
                  <p className="text-xs text-muted-foreground">High-speed 45 PPM monochrome xerox copiers (LAN Connected)</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bwSingle" className="text-xs font-medium text-muted-foreground">
                    Single-sided (₹ / page)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-semibold">₹</span>
                    <Input
                      id="bwSingle"
                      type="number"
                      step="0.25"
                      min="0"
                      value={pricing.bwSingle}
                      onChange={(e) => handleRateChange("bwSingle", e.target.value)}
                      className="pl-7 bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bwDouble" className="text-xs font-medium text-muted-foreground">
                    Double-sided duplex (₹ / sheet)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-semibold">₹</span>
                    <Input
                      id="bwDouble"
                      type="number"
                      step="0.25"
                      min="0"
                      value={pricing.bwDouble}
                      onChange={(e) => handleRateChange("bwDouble", e.target.value)}
                      className="pl-7 bg-background"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Colour Rates */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
              <div className="flex items-center gap-2.5 pb-4 border-b border-border">
                <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Printer className="size-4" />
                </span>
                <div>
                  <h3 className="font-display font-semibold text-foreground">Colour (Epson L5290 Series)</h3>
                  <p className="text-xs text-muted-foreground">High-precision colour ink jet printing</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="colourSingle" className="text-xs font-medium text-muted-foreground">
                    Single-sided (₹ / page)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-semibold">₹</span>
                    <Input
                      id="colourSingle"
                      type="number"
                      step="0.5"
                      min="0"
                      value={pricing.colourSingle}
                      onChange={(e) => handleRateChange("colourSingle", e.target.value)}
                      className="pl-7 bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="colourDouble" className="text-xs font-medium text-muted-foreground">
                    Double-sided (₹ / sheet)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-semibold">₹</span>
                    <Input
                      id="colourDouble"
                      type="number"
                      step="0.5"
                      min="0"
                      value={pricing.colourDouble}
                      onChange={(e) => handleRateChange("colourDouble", e.target.value)}
                      className="pl-7 bg-background"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Paper Multipliers & Surcharges */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
              <div className="flex items-center gap-2.5 pb-4 border-b border-border">
                <span className="grid size-8 place-items-center rounded-lg bg-secondary text-foreground">
                  <Layers className="size-4" />
                </span>
                <div>
                  <h3 className="font-display font-semibold text-foreground">Format Multipliers & Platform Fee</h3>
                  <p className="text-xs text-muted-foreground">Rules for special formats and service handling</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="a3Multiplier" className="text-xs font-medium text-muted-foreground">
                    A3 Paper Size Multiplier (e.g. 2.0x)
                  </Label>
                  <Input
                    id="a3Multiplier"
                    type="number"
                    step="0.5"
                    min="1"
                    value={pricing.a3Multiplier}
                    onChange={(e) => handleRateChange("a3Multiplier", e.target.value)}
                    className="bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="platformFee" className="text-xs font-medium text-muted-foreground">
                    Convenience / Platform Fee (₹)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-semibold">₹</span>
                    <Input
                      id="platformFee"
                      type="number"
                      step="1"
                      min="0"
                      value={pricing.platformFee}
                      onChange={(e) => handleRateChange("platformFee", e.target.value)}
                      className="pl-7 bg-background"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live Price Calculator & Simulator */}
          <div className="space-y-6 lg:col-span-5">
            <div className="sticky top-24 rounded-xl border border-border bg-card p-6 shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div>
                  <h3 className="font-display font-semibold text-foreground">Live Rate Simulator</h3>
                  <p className="text-xs text-muted-foreground">Preview student checkout calculations</p>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  Interactive
                </span>
              </div>

              {/* Simulator Controls */}
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Document Pages</Label>
                    <Input
                      type="number"
                      min="1"
                      value={simPages}
                      onChange={(e) => setSimPages(Math.max(1, parseInt(e.target.value) || 1))}
                      className="mt-1 bg-background"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Copies</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={simCopies}
                      onChange={(e) => setSimCopies(Math.max(1, parseInt(e.target.value) || 1))}
                      className="mt-1 bg-background"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Mode & Side</Label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSimMode("bw")}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                        simMode === "bw"
                          ? "border-primary bg-primary/5 text-primary font-semibold"
                          : "border-border bg-background text-muted-foreground"
                      }`}
                    >
                      Black & White
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimMode("colour")}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                        simMode === "colour"
                          ? "border-primary bg-primary/5 text-primary font-semibold"
                          : "border-border bg-background text-muted-foreground"
                      }`}
                    >
                      Colour
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSimSides("single")}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                      simSides === "single"
                        ? "border-primary bg-primary/5 text-primary font-semibold"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    Single-sided
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimSides("double")}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                      simSides === "double"
                        ? "border-primary bg-primary/5 text-primary font-semibold"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    Double-sided
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSimPaper("A4")}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                      simPaper === "A4"
                        ? "border-primary bg-primary/5 text-primary font-semibold"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    Standard A4
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimPaper("A3")}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                      simPaper === "A3"
                        ? "border-primary bg-primary/5 text-primary font-semibold"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    Large A3
                  </button>
                </div>
              </div>

              {/* Price Calculation Output Box */}
              <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Estimated Student Price</p>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-display text-3xl font-bold tracking-tight text-foreground">
                    ₹{simulated.total.toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {simulated.sheets * simCopies} sheets total
                  </span>
                </div>

                <div className="mt-4 space-y-1.5 border-t border-primary/15 pt-3 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Base rate per unit</span>
                    <span className="font-medium text-foreground">₹{simulated.unitRate.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Physical paper sheets</span>
                    <span className="font-medium text-foreground">{simulated.sheets} / copy</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Convenience fee</span>
                    <span className="font-medium text-foreground">₹{simulated.platformFee.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <Button onClick={handleSave} className="w-full gap-2 shadow-xs">
                  <Save className="size-4" />
                  Apply & Save Rates
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
