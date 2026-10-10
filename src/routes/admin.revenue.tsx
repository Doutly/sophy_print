import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Banknote, Calendar, Download, PieChart, Printer, TrendingUp, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { getStoredPrintJobs, subscribeToOrders, type PrintJob } from "@/lib/print-data";

export const Route = createFileRoute("/admin/revenue")({
  head: () => ({
    meta: [
      { title: "Revenue & Analytics — Sophy Print" },
      { name: "description", content: "Campus print revenue analytics, earnings breakdown, and machine financial metrics." },
      { property: "og:title", content: "Revenue & Analytics — Sophy Print" },
      { property: "og:description", content: "Financial analytics and machine volume breakdown." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RevenuePage,
});

function RevenuePage() {
  const [jobs, setJobs] = useState<PrintJob[]>(getStoredPrintJobs());
  const [timeRange, setTimeRange] = useState<"today" | "week" | "month">("today");

  useEffect(() => {
    const unsubscribe = subscribeToOrders((liveJobs) => {
      setJobs(liveJobs);
    });
    return () => unsubscribe();
  }, []);

  // Filter orders according to timeRange
  const filteredJobs = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
    const monthStart = todayStart - 30 * 24 * 60 * 60 * 1000;

    return jobs.filter((job) => {
      const jobTime = job.createdAt ? new Date(job.createdAt).getTime() : todayStart;
      if (timeRange === "today") return jobTime >= todayStart;
      if (timeRange === "week") return jobTime >= weekStart;
      return jobTime >= monthStart;
    });
  }, [jobs, timeRange]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const gross = filteredJobs.reduce((acc, j) => acc + (j.amount || 0), 0);
    const totalJobs = filteredJobs.length;
    const sheets = filteredJobs.reduce((acc, j) => acc + (j.pages || 0) * (j.copies || 1), 0);
    const avgOrder = totalJobs > 0 ? (gross / totalJobs).toFixed(2) : "0.00";
    const uniqueStudents = new Set(filteredJobs.map((j) => j.student)).size;

    return { gross, totalJobs, sheets, avgOrder, uniqueStudents };
  }, [filteredJobs]);

  // Real hourly distribution
  const hourlyRevenue = useMemo(() => {
    const hours = ["8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM"];
    const hourAmounts = new Array(hours.length).fill(0);
    const hourJobs = new Array(hours.length).fill(0);

    for (const job of filteredJobs) {
      if (job.createdAt) {
        const hour = new Date(job.createdAt).getHours();
        const index = hour - 8;
        if (index >= 0 && index < hours.length) {
          hourAmounts[index] += job.amount || 0;
          hourJobs[index]++;
        }
      }
    }

    const max = Math.max(...hourAmounts, 1);
    return hours.map((h, i) => ({
      hour: h,
      amount: hourAmounts[i],
      jobs: hourJobs[i],
      percentage: hourAmounts[i] > 0 ? Math.max(12, Math.round((hourAmounts[i] / max) * 100)) : 4,
    }));
  }, [filteredJobs]);

  // Machine breakdown
  const machineBreakdown = useMemo(() => {
    const bwJobs = filteredJobs.filter((j) => j.type === "B&W" || j.printer?.includes("Kyocera"));
    const colourJobs = filteredJobs.filter((j) => j.type === "Colour" || j.printer?.includes("Epson"));

    const bwRevenue = bwJobs.reduce((acc, j) => acc + (j.amount || 0), 0);
    const colourRevenue = colourJobs.reduce((acc, j) => acc + (j.amount || 0), 0);
    const totalRev = bwRevenue + colourRevenue || 1;

    const bwPages = bwJobs.reduce((acc, j) => acc + (j.pages || 0) * (j.copies || 1), 0);
    const colourPages = colourJobs.reduce((acc, j) => acc + (j.pages || 0) * (j.copies || 1), 0);

    return {
      kyocera: {
        revenue: bwRevenue,
        jobs: bwJobs.length,
        pages: bwPages,
        percentage: Math.round((bwRevenue / totalRev) * 100) || 0,
      },
      epson: {
        revenue: colourRevenue,
        jobs: colourJobs.length,
        pages: colourPages,
        percentage: Math.round((colourRevenue / totalRev) * 100) || 0,
      },
    };
  }, [filteredJobs]);

  const exportCSV = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Order,Date,Document,Type,Pages,Copies,Amount,Status\n" +
      filteredJobs
        .map((j) => `${j.id},${j.placed},${j.file},${j.type},${j.pages},${j.copies},${j.amount},${j.status}`)
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sophy_print_revenue_${timeRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AdminShell
      title="Revenue & Analytics"
      eyebrow="Financial Operations"
      action={
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-card p-0.5 shadow-xs">
            {(["today", "week", "month"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition-all ${
                  timeRange === r
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 shadow-xs">
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Banknote className="size-4.5" />
              </span>
              <span className="flex items-center gap-0.5 text-xs font-semibold text-primary">
                <ArrowUpRight className="size-3.5" /> Live
              </span>
            </div>
            <p className="mt-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {timeRange === "today" ? "Today's Gross" : timeRange === "week" ? "Last 7 Days" : "Last 30 Days"}
            </p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
              ₹{metrics.gross.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">100% digital prepay collection</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-lg bg-secondary text-foreground">
                <Printer className="size-4.5" />
              </span>
              <span className="text-xs font-medium text-muted-foreground">{metrics.totalJobs} total</span>
            </div>
            <p className="mt-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Jobs Processed</p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
              {metrics.totalJobs}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{metrics.sheets} physical sheets printed</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-lg bg-secondary text-foreground">
                <TrendingUp className="size-4.5" />
              </span>
              <span className="text-xs font-medium text-muted-foreground">Per order</span>
            </div>
            <p className="mt-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Order Value</p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">₹{metrics.avgOrder}</p>
            <p className="mt-1 text-xs text-muted-foreground">Computed from actual transactions</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Users className="size-4.5" />
              </span>
              <span className="text-xs font-semibold text-primary">Unique</span>
            </div>
            <p className="mt-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Student Users</p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
              {metrics.uniqueStudents}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Active student accounts</p>
          </div>
        </div>

        {/* Charts & Machine Breakdown */}
        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          {/* Hourly Revenue Graph */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">Hourly Revenue Curve</h2>
                <p className="text-xs text-muted-foreground">Live throughput & payment volume</p>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Calendar className="size-3.5 text-primary" /> Active period: {timeRange}
              </span>
            </div>

            <div className="mt-8 flex h-52 items-end gap-3 px-2">
              {hourlyRevenue.map((item) => (
                <div key={item.hour} className="group relative flex flex-1 flex-col items-center h-full justify-end">
                  {/* Tooltip on hover */}
                  <div className="absolute -top-12 z-10 hidden rounded-md border border-border bg-card px-2.5 py-1 text-center shadow-md group-hover:block whitespace-nowrap">
                    <p className="text-[11px] font-bold text-foreground">₹{item.amount}</p>
                    <p className="text-[10px] text-muted-foreground">{item.jobs} jobs</p>
                  </div>
                  {/* Bar */}
                  <div
                    className={`w-full rounded-t-md transition-all duration-200 ${
                      item.amount > 0 ? "bg-primary group-hover:bg-primary/80" : "bg-secondary group-hover:bg-secondary/80"
                    }`}
                    style={{ height: `${item.percentage}%` }}
                  />
                  <span className="mt-2 text-[10px] font-medium text-muted-foreground">{item.hour}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
              <span>Opening: 8:00 AM</span>
              <span className="font-medium text-foreground">Shop Operating Hours</span>
              <span>Closing: 5:00 PM</span>
            </div>
          </section>

          {/* Machine Revenue Contribution */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div>
                  <h2 className="font-display text-lg font-semibold text-foreground">Machine Contribution</h2>
                  <p className="text-xs text-muted-foreground">Share of shop volume & revenue</p>
                </div>
                <PieChart className="size-4 text-primary" />
              </div>

              <div className="mt-6 space-y-5">
                {/* Kyocera */}
                <div className="rounded-lg border border-border bg-secondary/30 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display text-sm font-semibold text-foreground">Kyocera MZ3200i</p>
                      <p className="text-xs text-muted-foreground">Monochrome volume printing</p>
                    </div>
                    <span className="font-display text-lg font-bold text-foreground">
                      ₹{machineBreakdown.kyocera.revenue.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full bg-foreground rounded-full"
                        style={{ width: `${machineBreakdown.kyocera.percentage}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-foreground">
                      {machineBreakdown.kyocera.percentage}%
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {machineBreakdown.kyocera.jobs} jobs · {machineBreakdown.kyocera.pages} pages
                  </p>
                </div>

                {/* Epson */}
                <div className="rounded-lg border border-border bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display text-sm font-semibold text-foreground">Epson L5290 Series</p>
                      <p className="text-xs text-muted-foreground">High-margin colour prints</p>
                    </div>
                    <span className="font-display text-lg font-bold text-primary">
                      ₹{machineBreakdown.epson.revenue.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary/20">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${machineBreakdown.epson.percentage}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-primary">
                      {machineBreakdown.epson.percentage}%
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {machineBreakdown.epson.jobs} jobs · {machineBreakdown.epson.pages} pages
                  </p>
                </div>
              </div>
            </div>

            {/* Prepay method overview */}
            <div className="mt-6 border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Prepay Method Split</p>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-md border border-border bg-card p-2">
                  <p className="text-[11px] text-muted-foreground">Digital (UPI / QR)</p>
                  <p className="font-display text-sm font-bold text-foreground">100%</p>
                </div>
                <div className="rounded-md border border-border bg-card p-2">
                  <p className="text-[11px] text-muted-foreground">Failed Payments</p>
                  <p className="font-display text-sm font-bold text-foreground">0%</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
