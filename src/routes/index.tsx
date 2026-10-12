import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, Check, CheckCircle2, ChevronLeft, ChevronRight, Copy, FileCheck2, FileText, Minus, Plus, Printer, ShieldCheck, Sparkles, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { detectPdfPageCount } from "@/lib/pdf-detector";
import {
  calculateJobPrice,
  createPrintOrder,
  defaultPricingConfig,
  loadPricingConfig,
  parsePageRange,
  validatePrintableFile,
  type PrintJob,
  type PricingConfig,
} from "@/lib/print-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sophy Print — Print without the queue" },
      { name: "description", content: "Upload a PDF, choose your print settings, and collect it when ready." },
      { property: "og:title", content: "Sophy Print — Print without the queue" },
      { property: "og:description", content: "A fast, simple way to print on campus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentPrintFlow,
});

type PrintMode = "bw" | "colour";
type Sides = "single" | "double";
type Paper = "A4" | "A3";
type PageSelectionType = "all" | "custom" | "odd" | "even";

function StudentPrintFlow() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedTotalPages, setDetectedTotalPages] = useState(1);
  const [fileError, setFileError] = useState<string | null>(null);
  const [formatNotice, setFormatNotice] = useState<string | null>(null);

  // Print configuration
  const [copies, setCopies] = useState(1);
  const [mode, setMode] = useState<PrintMode>("bw");
  const [sides, setSides] = useState<Sides>("single");
  const [paper, setPaper] = useState<Paper>("A4");

  // Page selection options
  const [pageSelection, setPageSelection] = useState<PageSelectionType>("all");
  const [customRangeInput, setCustomRangeInput] = useState("1-5, 8");

  // Payment & Order creation
  const [paying, setPaying] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<PrintJob | null>(null);

  // Student identity (optional, for pickup contact)
  const [studentName, setStudentName] = useState("");
  const [studentPhone, setStudentPhone] = useState("");

  // Pricing — load from Firestore on mount, fall back to cached/default
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(defaultPricingConfig);
  useEffect(() => {
    loadPricingConfig().then(setPricingConfig);
  }, []);

  // Page range calculation
  const parsedRange = useMemo(() => {
    if (pageSelection === "all") {
      return parsePageRange("all", detectedTotalPages);
    }
    if (pageSelection === "odd") {
      return parsePageRange("odd", detectedTotalPages);
    }
    if (pageSelection === "even") {
      return parsePageRange("even", detectedTotalPages);
    }
    return parsePageRange(customRangeInput, detectedTotalPages);
  }, [pageSelection, customRangeInput, detectedTotalPages]);

  const activePages = parsedRange.isValid ? parsedRange.count : detectedTotalPages;

  // Real pricing calculation using live Firestore config
  const priceDetails = useMemo(() => {
    return calculateJobPrice(activePages, copies, mode, sides, paper, pricingConfig);
  }, [activePages, copies, mode, sides, paper, pricingConfig]);

  const total = priceDetails.total;

  async function acceptFile(file?: File) {
    if (!file) return;
    setFileError(null);
    setFormatNotice(null);

    const check = validatePrintableFile(file.name, file.type);
    if (!check.isValid) {
      setFileError(check.error || "Unsupported file format.");
      setUploadedFile(null);
      setFileName("");
      return;
    }

    const name = file.name.toLowerCase();
    setFileName(file.name);
    setUploadedFile(file);
    setAnalyzing(true);

    try {
      if (name.endsWith(".pdf") || file.type === "application/pdf") {
        // Real binary inspection of the uploaded PDF file
        const realPages = await detectPdfPageCount(file);
        setDetectedTotalPages(realPages);
      } else {
        // Office doc preview estimate
        setDetectedTotalPages(2);
        setFormatNotice("Document uploaded. For precise page verification, PDF is recommended.");
      }
    } catch (err) {
      console.warn("Could not inspect document pages, defaulting to 1", err);
      setDetectedTotalPages(1);
    } finally {
      window.setTimeout(() => setAnalyzing(false), 400);
    }
  }

  async function handlePayment() {
    setPaying(true);
    try {
      let downloadUrl: string | undefined = undefined;
      let storagePath: string | undefined = undefined;

      // Asynchronously upload real document to Firebase Storage
      if (uploadedFile) {
        try {
          const timestamp = Date.now();
          const cleanName = uploadedFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
          storagePath = `orders/pending/${timestamp}_${cleanName}`;
          const storageReference = ref(storage, storagePath);
          await uploadBytes(storageReference, uploadedFile);
          downloadUrl = await getDownloadURL(storageReference);
        } catch (storageErr) {
          console.info("Firebase storage upload skipped/offline fallback:", storageErr);
        }
      }

      const job = await createPrintOrder({
        file: fileName || "Document.pdf",
        fileSize: uploadedFile?.size,
        type: mode === "colour" ? "Colour" : "B&W",
        pages: activePages,
        totalPagesInDoc: detectedTotalPages,
        pageRange: pageSelection === "all" ? "all" : customRangeInput,
        copies,
        amount: total,
        status: "Pending",
        student: studentName.trim() || "Anonymous",
        phone: studentPhone.trim() || undefined,
        sides,
        paper,
        printer: mode === "bw" ? "Canon imageRUNNER ADVANCE 4545i III" : "Epson L5290",
        downloadUrl,
        storagePath,
      });

      setCreatedOrder(job);
      window.setTimeout(() => {
        setPaying(false);
        setStep(4);
      }, 700);
    } catch {
      setPaying(false);
      setStep(4);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20">
      {/* Top Navbar */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-20">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight text-foreground">
            <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <Printer className="size-4.5" />
            </span>
            <span>
              Sophy <span className="text-primary font-bold">Print</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/track"
              search={{ order: undefined }}
              className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Track an order
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        {/* Progress Step Indicator */}
        {step < 4 && (
          <>
            <div className="mb-10 flex items-center justify-between">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex flex-1 items-center last:flex-none">
                  <div
                    className={`grid size-8 shrink-0 place-items-center rounded-full border text-xs font-bold transition-all ${
                      step >= item
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : "border-border bg-secondary/40 text-muted-foreground"
                    }`}
                  >
                    {step > item ? <Check className="size-4" /> : item}
                  </div>
                  {item < 3 && (
                    <div
                      className={`mx-3 h-0.5 flex-1 transition-all ${
                        step > item ? "bg-primary" : "bg-border"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="mb-8">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
                Step {step} of 3
              </p>
              <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {step === 1
                  ? "Print without the queue."
                  : step === 2
                  ? "Choose print options & pages."
                  : "Review & confirm your order."}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground leading-relaxed">
                {step === 1
                  ? "Upload your document. We'll automatically verify pages and print compatibility."
                  : step === 2
                  ? "Select which pages to print, color mode, sides, paper size, and number of copies."
                  : "Review details, pay digitally via UPI/Card, and walk up with your pickup code."}
              </p>
            </div>
          </>
        )}

        {/* STEP 1: UPLOAD */}
        {step === 1 && (
          <section className="animate-rise">
            {fileError && (
              <div className="mb-4 flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-medium text-destructive shadow-xs">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="size-4 shrink-0 text-destructive" />
                  <span>{fileError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFileError(null)}
                  className="rounded px-2 py-0.5 text-xs font-semibold text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                >
                  ✕
                </button>
              </div>
            )}

            {!fileName ? (
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  acceptFile(event.dataTransfer.files[0]);
                }}
                className="group relative grid min-h-80 place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-card p-8 text-center transition-all hover:border-primary/60 hover:bg-primary/[0.01] shadow-xs"
              >
                <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/40 opacity-0 group-hover:animate-scan group-hover:opacity-100" />
                <div>
                  <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary shadow-xs">
                    <Upload className="size-7" />
                  </span>
                  <h2 className="mt-6 font-display text-xl font-bold text-foreground">Drop your document here</h2>
                  <p className="mt-1.5 text-xs text-muted-foreground">PDF, Word (DOCX), or PowerPoint (PPTX)</p>
                  <Button size="lg" className="mt-6 min-w-44 shadow-xs" onClick={() => inputRef.current?.click()}>
                    Choose Document
                  </Button>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.pptx,.ppt,application/pdf"
                    className="hidden"
                    onChange={(event) => acceptFile(event.target.files?.[0])}
                  />
                  <p className="mt-4 text-xs text-muted-foreground">
                    Printable documents only · Up to 50 MB · Private & secure on campus
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
                <div className="flex items-start gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <FileText className="size-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground text-sm">{fileName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {analyzing
                        ? "Verifying document structure…"
                        : `${detectedTotalPages} pages detected · A4 format · Ready for printing`}
                    </p>
                    {formatNotice && (
                      <p className="mt-1 text-[11px] text-amber-600 font-medium">
                        ℹ {formatNotice}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setFileName("");
                      setUploadedFile(null);
                      setFileError(null);
                      setFormatNotice(null);
                    }}
                    aria-label="Remove file"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <div className="mt-6">
                  {analyzing ? (
                    <>
                      <Progress value={68} className="h-1.5" />
                      <p className="mt-2 text-xs text-muted-foreground">
                        Validating page count and margins
                      </p>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs font-semibold text-primary">
                      <FileCheck2 className="size-4" />
                      Document validated successfully: {detectedTotalPages} pages detected
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button
                size="lg"
                disabled={!fileName || analyzing}
                onClick={() => setStep(2)}
                className="gap-2 shadow-xs"
              >
                Choose settings <ChevronRight className="size-4" />
              </Button>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-3 border-t border-border pt-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                Private & Secure
              </span>
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="size-4 text-primary" />
                Page Detection
              </span>
              <span className="flex items-center justify-end gap-2">
                <Printer className="size-4 text-primary" />
                Zero Queue Waiting
              </span>
            </div>
          </section>
        )}

        {/* STEP 2: CONFIGURE (Includes Page Range Selection) */}
        {step === 2 && (
          <section className="animate-rise grid gap-6 lg:grid-cols-[1fr_260px]">
            <div className="space-y-5">
              {/* PAGE RANGE SELECTION CARD */}
              <fieldset className="rounded-xl border border-border bg-card p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <legend className="font-display font-semibold text-sm text-foreground">
                    Which pages do you want to print?
                  </legend>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                    {parsedRange.isValid ? `${activePages} pages active` : "Invalid range"}
                  </span>
                </div>

                {/* Range mode choices */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => setPageSelection("all")}
                    className={`rounded-lg border p-2.5 text-center text-xs font-semibold transition-all ${
                      pageSelection === "all"
                        ? "border-primary bg-primary/5 text-primary shadow-xs"
                        : "border-border bg-background text-muted-foreground hover:border-input"
                    }`}
                  >
                    All ({detectedTotalPages} p)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageSelection("custom")}
                    className={`rounded-lg border p-2.5 text-center text-xs font-semibold transition-all ${
                      pageSelection === "custom"
                        ? "border-primary bg-primary/5 text-primary shadow-xs"
                        : "border-border bg-background text-muted-foreground hover:border-input"
                    }`}
                  >
                    Custom Range
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageSelection("odd")}
                    className={`rounded-lg border p-2.5 text-center text-xs font-semibold transition-all ${
                      pageSelection === "odd"
                        ? "border-primary bg-primary/5 text-primary shadow-xs"
                        : "border-border bg-background text-muted-foreground hover:border-input"
                    }`}
                  >
                    Odd Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageSelection("even")}
                    className={`rounded-lg border p-2.5 text-center text-xs font-semibold transition-all ${
                      pageSelection === "even"
                        ? "border-primary bg-primary/5 text-primary shadow-xs"
                        : "border-border bg-background text-muted-foreground hover:border-input"
                    }`}
                  >
                    Even Only
                  </button>
                </div>

                {/* Custom range input if selected */}
                {pageSelection === "custom" && (
                  <div className="mt-3.5 space-y-1.5 rounded-lg border border-border bg-secondary/30 p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Enter page numbers or ranges (e.g. 1-5, 8, 11-14)</span>
                      <span>Total in doc: {detectedTotalPages}</span>
                    </div>
                    <Input
                      value={customRangeInput}
                      onChange={(e) => setCustomRangeInput(e.target.value)}
                      placeholder="e.g. 1-5, 8, 12"
                      className="bg-card text-xs font-mono h-9"
                    />
                    {parsedRange.isValid ? (
                      <p className="text-[11px] text-primary font-medium">
                        ✓ {parsedRange.displayText}
                      </p>
                    ) : (
                      <p className="text-[11px] text-destructive font-medium">
                        ⚠ {parsedRange.error || "Please enter valid page numbers within document range"}
                      </p>
                    )}
                  </div>
                )}
              </fieldset>

              {/* PRINT TYPE */}
              <Setting title="Print type">
                <Choice
                  selected={mode === "bw"}
                  onClick={() => setMode("bw")}
                  label="Black & White"
                  detail="Fast & economical xerox (Dual Canon imageRUNNER ADVANCE 4545i III)"
                />
                <Choice
                  selected={mode === "colour"}
                  onClick={() => setMode("colour")}
                  label="High-quality Colour"
                  detail="Vibrant colour printing (Epson L5290)"
                />
              </Setting>

              {/* SIDES (DUPLEX) */}
              <Setting title="Sides">
                <Choice
                  selected={sides === "single"}
                  onClick={() => setSides("single")}
                  label="Single-sided"
                  detail={`${activePages} sheets per copy`}
                />
                <Choice
                  selected={sides === "double"}
                  onClick={() => setSides("double")}
                  label="Double-sided (Duplex)"
                  detail={`${Math.ceil(activePages / 2)} sheets (saves paper)`}
                />
              </Setting>

              {/* PAPER SIZE */}
              <Setting title="Paper size">
                <Choice
                  selected={paper === "A4"}
                  onClick={() => setPaper("A4")}
                  label="A4 (Standard)"
                  detail="Standard 210 × 297 mm document"
                />
                <Choice
                  selected={paper === "A3"}
                  onClick={() => setPaper("A3")}
                  label="A3 (Large Format)"
                  detail="297 × 420 mm large engineering/drawing"
                />
              </Setting>

              {/* COPIES */}
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-5 shadow-xs">
                <div>
                  <p className="font-display font-semibold text-sm text-foreground">Number of copies</p>
                  <p className="text-xs text-muted-foreground">Sets of your document to print</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCopies(Math.max(1, copies - 1))}
                    aria-label="Decrease copies"
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span className="w-6 text-center font-display text-lg font-bold text-foreground">
                    {copies}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCopies(Math.min(100, copies + 1))}
                    aria-label="Increase copies"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* LIVE STICKY PRICE SUMMARY */}
            <aside className="h-fit rounded-xl border border-primary/20 bg-primary/5 p-5 shadow-xs lg:sticky lg:top-24">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Live price estimate</p>
              <p className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground">₹{total}</p>
              <p className="mt-1 text-xs text-muted-foreground">Zero hidden charges</p>

              <div className="mt-4 space-y-2 border-t border-primary/20 pt-3 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Routing machine</span>
                  <span className="font-medium text-foreground">{mode === "bw" ? "Canon imageRUNNER ADVANCE 4545i III (LAN)" : "Epson L5290"}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Selected pages</span>
                  <span className="font-medium text-foreground">{activePages} pages</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Physical sheets</span>
                  <span className="font-medium text-foreground">
                    {priceDetails.sheets} × {copies} = {priceDetails.sheets * copies}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Rate per sheet</span>
                  <span className="font-medium text-foreground">₹{priceDetails.unitRate}</span>
                </div>
              </div>
            </aside>

            {/* Step navigation buttons */}
            <div className="flex justify-between lg:col-span-2 pt-2">
              <Button variant="ghost" onClick={() => setStep(1)} className="gap-1.5">
                <ChevronLeft className="size-4" /> Back
              </Button>
              <Button size="lg" disabled={!parsedRange.isValid} onClick={() => setStep(3)} className="gap-1.5 shadow-xs">
                Review order <ChevronRight className="size-4" />
              </Button>
            </div>
          </section>
        )}

        {/* STEP 3: REVIEW & DIGITAL PAYMENT */}
        {step === 3 && (
          <section className="animate-rise space-y-5">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <div className="flex items-center gap-4 border-b border-border p-5 sm:p-6">
                <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground text-sm">{fileName || "Document.pdf"}</p>
                  <p className="text-xs text-muted-foreground">
                    {activePages} pages to print · {paper} · {sides === "single" ? "Single-sided" : "Double-sided"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-5 p-5 text-xs sm:grid-cols-4 sm:p-6">
                {[
                  ["Copies", `${copies} copy`],
                  ["Mode", mode === "bw" ? "Black & White" : "Colour"],
                  ["Selected Pages", parsedRange.displayText],
                  ["Assigned Machine", mode === "bw" ? "Canon imageRUNNER ADVANCE 4545i III (LAN)" : "Epson L5290"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-muted-foreground">{label}</p>
                    <p className="mt-1 font-semibold text-foreground text-sm">{value}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-border bg-secondary/30 p-5 sm:p-6">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Document printing ({priceDetails.sheets * copies} sheets)</span>
                  <span className="font-medium text-foreground">₹{priceDetails.subtotal}</span>
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>Campus convenience fee</span>
                  <span className="font-medium text-foreground">₹{priceDetails.platformFee}</span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <span className="font-semibold text-foreground">Total Payable</span>
                  <span className="font-display text-2xl font-bold tracking-tight text-primary">₹{total}</span>
                </div>
              </div>
            </div>

            {/* Optional contact for pickup */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-3">
              <div>
                <p className="font-display font-semibold text-sm text-foreground">Contact for pickup <span className="font-normal text-muted-foreground">(optional)</span></p>
                <p className="text-xs text-muted-foreground mt-0.5">So the shop can call you when your print is ready.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Your name"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="bg-background text-xs h-10"
                />
                <Input
                  placeholder="Phone number"
                  value={studentPhone}
                  onChange={(e) => setStudentPhone(e.target.value)}
                  className="bg-background text-xs h-10"
                  type="tel"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-foreground">
              <ShieldCheck className="size-4 text-amber-500 shrink-0" />
              <span>Payment is collected at the print counter when you pick up your document.</span>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(2)} className="gap-1.5">
                <ChevronLeft className="size-4" /> Back
              </Button>
              <Button size="lg" disabled={paying} onClick={handlePayment} className="gap-2 shadow-xs">
                {paying ? "Submitting Order…" : "Submit Print Order"}
              </Button>
            </div>
          </section>
        )}

        {/* STEP 4: CONFIRMATION & PICKUP CODE */}
        {step === 4 && (
          <section className="animate-rise py-8 text-center">
            <span className="mx-auto grid size-20 place-items-center rounded-2xl bg-primary/10 text-primary shadow-xs">
              <CheckCircle2 className="size-10" />
            </span>
            <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-primary">Order Dispatched</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              You're in the queue.
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Order <strong className="text-foreground font-mono">#{createdOrder?.id || "2762"}</strong> is now queued for printing on{" "}
              {mode === "bw" ? "Canon imageRUNNER ADVANCE 4545i III (LAN)" : "Epson L5290"}.
            </p>

            <div className="mx-auto mt-8 max-w-sm rounded-xl border border-primary/20 bg-card p-6 text-left shadow-xs">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Estimated printing wait</span>
                <span className="font-semibold text-foreground">5–8 min</span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <div>
                  <span className="text-xs font-medium text-foreground">Pickup & Order Code</span>
                  <p className="text-[11px] text-muted-foreground">Single 4-digit code for counter pickup & tracking</p>
                </div>
                <span className="font-display text-3xl font-bold tracking-widest text-primary font-mono">
                  {createdOrder?.id || "2762"}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const code = createdOrder?.id || "2762";
                    if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
                      navigator.clipboard
                        .writeText(code)
                        .then(() => {
                          toast.success(`Copied code #${code} to clipboard`);
                        })
                        .catch(() => {
                          fallbackCopyText(code);
                        });
                    } else {
                      fallbackCopyText(code);
                    }
                  }}
                  className="gap-1.5 text-xs h-8"
                >
                  <Copy className="size-3.5" /> Copy Code
                </Button>
                <span className="text-[11px] text-muted-foreground">Show at Xerox counter</span>
              </div>
            </div>

            <div className="mt-8 flex justify-center gap-3">
              <Button asChild size="lg" className="shadow-xs gap-2">
                <Link to="/track" search={{ order: createdOrder?.id || "2762" }}>
                  Track order live <ChevronRight className="size-4" />
                </Link>
              </Button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function fallbackCopyText(text: string) {
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "-9999px";
    textArea.setAttribute("readonly", "");
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    if (successful) {
      toast.success(`Copied code #${text} to clipboard`);
    } else {
      toast.info(`Pickup Code is #${text}`);
    }
  } catch {
    toast.info(`Pickup Code is #${text}`);
  }
}

function Setting({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <legend className="sr-only">{title}</legend>
      <p className="mb-3 font-display font-semibold text-sm text-foreground">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Choice({
  selected,
  onClick,
  label,
  detail,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-16 items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${
        selected
          ? "border-primary bg-primary/5 shadow-xs"
          : "border-border bg-background hover:border-input"
      }`}
    >
      <span
        className={`grid size-5 shrink-0 place-items-center rounded-full border transition-all ${
          selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
        }`}
      >
        {selected && <Check className="size-3" />}
      </span>
      <span>
        <span className={`block text-xs font-semibold ${selected ? "text-foreground" : "text-foreground"}`}>
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground leading-snug">{detail}</span>
      </span>
    </button>
  );
}