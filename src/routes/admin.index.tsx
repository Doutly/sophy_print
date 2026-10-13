import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Banknote,
  FileText,
  Layers3,
  Printer,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { getStoredPrintJobs, subscribeToOrders, type PrintJob } from "@/lib/print-data";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin overview — Sophy Print" },
      { name: "description", content: "Sophy Print shop operations overview." },
      { property: "og:title", content: "Admin overview — Sophy Print" },
      { property: "og:description", content: "Live print operations at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const [jobs, setJobs] = useState<PrintJob[]>(getStoredPrintJobs());

  useEffect(() => {
    const unsubscribe = subscribeToOrders((liveJobs) => {
      setJobs(liveJobs);
    });
    return () => unsubscribe();
  }, []);

  // Compute 100% dynamic live metrics
  const liveStats = useMemo(() => {
    const revenue = jobs.reduce((acc, j) => acc + (j.amount || 0), 0);
    const pages = jobs.reduce((acc, j) => acc + (j.pages || 0) * (j.copies || 1), 0);
    const active = jobs.filter(
      (j) => j.status === "Printing" || j.status === "Waiting" || j.status === "Pending",
    ).length;

    return [
      {
        icon: Banknote,
        label: "Total Revenue",
        value: `₹${revenue.toLocaleString("en-IN")}`,
        note: jobs.length > 0 ? `${jobs.length} orders` : "Zero mock data",
      },
      {
        icon: Printer,
        label: "Print Jobs",
        value: jobs.length.toString(),
        note: active > 0 ? `${active} in queue` : "All clear",
      },
      {
        icon: FileText,
        label: "Pages Processed",
        value: pages.toLocaleString(),
        note: "Verified total",
      },
      {
        icon: Layers3,
        label: "Active Queue",
        value: active.toString(),
        note: active > 0 ? "In progress" : "No waiting jobs",
      },
    ];
  }, [jobs]);

  // Dynamic hourly breakdown from real orders
  const hourlyData = useMemo(() => {
    const hours = [
      "8 AM",
      "9 AM",
      "10 AM",
      "11 AM",
      "12 PM",
      "1 PM",
      "2 PM",
      "3 PM",
      "4 PM",
      "5 PM",
    ];
    const counts = new Array(hours.length).fill(0);

    for (const job of jobs) {
      if (job.createdAt) {
        const hour = new Date(job.createdAt).getHours();
        const index = hour - 8;
        if (index >= 0 && index < counts.length) {
          counts[index]++;
        }
      }
    }

    const max = Math.max(...counts, 1);
    return hours.map((h, i) => ({
      hour: h,
      count: counts[i],
      percentage: counts[i] > 0 ? Math.max(15, Math.round((counts[i] / max) * 100)) : 4,
    }));
  }, [jobs]);

  return (
    <AdminShell title="Shop Operations Dashboard" eyebrow="Live Cloud Queue">
      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {liveStats.map(({ icon: Icon, label, value, note }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
              <span className="text-xs font-semibold text-primary">{note}</span>
            </div>
            <p className="mt-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Main Grid: Queue preview & Throughput */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">
                Live print queue
              </h2>
              <p className="text-xs text-muted-foreground">Real-time incoming student documents</p>
            </div>
            <Link
              to="/admin/queue"
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              View all <ArrowRight className="size-3.5" />
            </Link>
          </div>

          {jobs.length === 0 ? (
            <div className="p-10 text-center text-xs text-muted-foreground">
              <Printer className="mx-auto size-8 text-muted-foreground/40 mb-2" />
              <p className="font-semibold text-foreground">Queue is currently clear</p>
              <p className="mt-1">
                When students place print orders on the campus portal, they will appear here live.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {jobs.slice(0, 4).map((job) => (
                <div
                  key={job.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 p-4 transition-colors hover:bg-secondary/40 sm:grid-cols-[90px_1fr_110px_auto]"
                >
                  <span className="font-mono text-xs font-semibold text-foreground">#{job.id}</span>
                  <div className="hidden min-w-0 sm:block">
                    <p className="truncate text-xs font-medium text-foreground">{job.file}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {job.placed} · {job.type}
                    </p>
                  </div>
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    {job.pages} pages
                  </span>
                  <Status status={job.status} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">
                Hourly Throughput
              </h2>
              <p className="text-xs text-muted-foreground">Real orders finished by hour</p>
            </div>
            <TrendingUp className="size-4.5 text-primary" />
          </div>

          <div className="mt-8 flex h-48 items-end gap-2 px-1">
            {hourlyData.map(({ hour, count, percentage }) => (
              <div
                key={hour}
                title={`${hour}: ${count} jobs`}
                className={`flex-1 rounded-t-sm transition-all ${
                  count > 0
                    ? "bg-primary hover:bg-primary/80"
                    : "bg-secondary hover:bg-secondary/80"
                }`}
                style={{ height: `${percentage}%` }}
              />
            ))}
          </div>

          <div className="mt-3 flex justify-between text-xs text-muted-foreground">
            <span>8 AM</span>
            <span>12 PM</span>
            <span>5 PM</span>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

function Status({ status }: { status: string }) {
  const style =
    status === "Printing"
      ? "bg-info/10 text-info border border-info/20"
      : status === "Ready" || status === "Completed"
        ? "bg-primary/10 text-primary border border-primary/20"
        : status === "Failed"
          ? "bg-destructive/10 text-destructive border border-destructive/20"
          : "bg-warning/10 text-warning border border-warning/20";

  return (
    <span className={`rounded-md px-2.5 py-0.5 text-xs font-semibold ${style}`}>{status}</span>
  );
}
