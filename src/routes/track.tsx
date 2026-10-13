import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  Clock3,
  PackageCheck,
  Printer,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchOrderById,
  getStoredPrintJobs,
  subscribeToOrderById,
  type PrintJob,
} from "@/lib/print-data";

export const Route = createFileRoute("/track")({
  validateSearch: (search: Record<string, unknown>) => ({
    order: typeof search["order"] === "string" ? (search["order"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Track your order — Sophy Print" },
      { name: "description", content: "Check your Sophy Print order and pickup status." },
      { property: "og:title", content: "Track your order — Sophy Print" },
      { property: "og:description", content: "Live print order progress and pickup details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrackPage,
});

interface TimelineItem {
  icon: LucideIcon;
  label: string;
  detail: string;
  active: boolean;
}

function TrackPage() {
  const search = Route.useSearch();
  const [query, setQuery] = useState(search.order ?? "");
  const [activeOrderId, setActiveOrderId] = useState(search.order ?? "");
  const [shown, setShown] = useState(Boolean(search.order));
  const [matchedJob, setMatchedJob] = useState<PrintJob | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!activeOrderId.trim()) {
      setMatchedJob(null);
      return;
    }
    setSearching(true);
    const unsub = subscribeToOrderById(activeOrderId, (job) => {
      setMatchedJob(job);
      setSearching(false);
    });
    return () => unsub();
  }, [activeOrderId]);

  useEffect(() => {
    if (search.order) {
      setQuery(search.order);
      setActiveOrderId(search.order);
      setShown(true);
    }
  }, [search.order]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setActiveOrderId(query.trim());
      setShown(true);
    }
  };

  const isReady = matchedJob?.status === "Ready" || matchedJob?.status === "Completed";
  const isPrinting = matchedJob?.status === "Printing" || isReady;
  const isAcknowledged = matchedJob?.status !== "Pending";

  const timelineSteps: TimelineItem[] = matchedJob
    ? [
        {
          icon: CheckCircle2,
          label: "Order received",
          detail: matchedJob.placed ? `Submitted at ${matchedJob.placed}` : "Order received",
          active: true,
        },
        {
          icon: Check,
          label: "Shop acknowledgement",
          detail:
            matchedJob.status === "Pending"
              ? "Awaiting print counter confirmation"
              : `Dispatched to ${matchedJob.printer || "shop printer"}`,
          active: isAcknowledged,
        },
        {
          icon: CircleDot,
          label: isReady ? "Printing completed" : "Printing in progress",
          detail: isReady
            ? "Finished printing"
            : matchedJob.status === "Printing"
              ? "Document printing on machine tray"
              : "In print queue",
          active: isPrinting,
        },
        {
          icon: PackageCheck,
          label: isReady ? "Ready for pickup!" : "Pickup counter",
          detail: isReady ? "Collect document now" : "Estimated wait 5–8 min",
          active: isReady,
        },
      ]
    : [];

  return (
    <main className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20">
      <header className="border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-18 max-w-5xl items-center justify-between px-5">
          <Link
            to="/"
            className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <Printer className="size-4" />
            </span>
            <span>
              Sophy <span className="text-primary font-bold">Print</span>
            </span>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ChevronLeft className="size-4" />
              New print
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-5 py-14 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Live Order Tracker
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Know exactly when it's ready.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your 4-digit pickup code or order number (e.g. 2762 or #2762) to see real-time queue
          progress.
        </p>

        <form className="mt-8 flex gap-2" onSubmit={handleSearch}>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. 2762 or #2762"
            className="h-11 bg-card text-sm shadow-xs font-mono"
          />
          <Button type="submit" size="lg" disabled={searching} className="gap-2 shadow-xs">
            <Search className="size-4" />
            {searching ? "Searching…" : "Track"}
          </Button>
        </form>

        {shown && (
          <>
            {matchedJob ? (
              <section className="mt-8 animate-rise overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                {/* Order Header */}
                <div className="border-b border-border p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Order Identifier</p>
                      <p className="font-display text-xl font-bold tracking-tight text-foreground">
                        #{matchedJob.id}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {matchedJob.status}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {jobTitle(matchedJob.file)} · {matchedJob.pages} pages · ₹{matchedJob.amount}
                  </p>
                </div>

                {/* Timeline Progress */}
                <div className="p-5 sm:p-6">
                  <div className="space-y-1">
                    {timelineSteps.map(({ icon: Icon, label, detail, active }, index) => (
                      <div key={label} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <span
                            className={`grid size-8 place-items-center rounded-full border transition-all ${
                              active
                                ? "border-primary bg-primary/10 text-primary shadow-xs"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            <Icon className="size-4" />
                          </span>
                          {index < timelineSteps.length - 1 && (
                            <span
                              className={`h-9 w-px ${active ? "bg-primary/40" : "bg-border"}`}
                            />
                          )}
                        </div>
                        <div className="pt-1">
                          <p
                            className={`text-sm font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}
                          >
                            {label}
                          </p>
                          <p className="text-xs text-muted-foreground">{detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pickup Code Display */}
                  <div className="mt-6 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4.5">
                    <div className="flex items-center gap-3">
                      <Clock3 className="size-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Show code at the Xerox counter
                        </p>
                        <p className="text-sm font-semibold text-foreground">
                          {isReady
                            ? "Ready for immediate collection"
                            : "Printing in progress on shop printer"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Pickup Code
                      </p>
                      <p className="font-display text-2xl font-bold tracking-widest text-primary">
                        {matchedJob.pickupCode}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <section className="mt-8 animate-rise rounded-xl border border-border bg-card p-8 text-center shadow-xs">
                <Printer className="mx-auto size-10 text-muted-foreground/40 mb-3" />
                <h2 className="font-display font-bold text-foreground text-base">
                  Order Not Found
                </h2>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  No active print order matches "{query}". Please check your order ID or place a new
                  print job.
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function jobTitle(file?: string) {
  return file || "Document.pdf";
}
