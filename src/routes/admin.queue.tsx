import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  CheckCircle2,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getStoredPrintJobs,
  subscribeToOrders,
  updateJobStatus,
  type JobStatus,
  type PrintJob,
} from "@/lib/print-data";

export const Route = createFileRoute("/admin/queue")({
  head: () => ({
    meta: [
      { title: "Live print queue — Sophy Print" },
      { name: "description", content: "Monitor and manage active Sophy Print jobs." },
      { property: "og:title", content: "Live print queue — Sophy Print" },
      { property: "og:description", content: "Monitor active college print jobs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QueuePage,
});

function QueuePage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [jobs, setJobs] = useState<PrintJob[]>(getStoredPrintJobs());
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToOrders((liveJobs) => {
      setJobs(liveJobs);
    });
    return () => unsubscribe();
  }, []);

  const handleStatusChange = async (jobId: string, newStatus: JobStatus) => {
    try {
      setUpdatingId(jobId);
      await updateJobStatus(jobId, newStatus);
      toast.success(`Order #${jobId} updated to "${newStatus}" in Firestore.`);
    } catch (err: any) {
      toast.error(`Could not update order #${jobId}: ${err?.message || "Check network/permissions"}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    const matchesQuery = `${job.id} ${job.file} ${job.student} ${job.pickupCode}`
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || job.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesQuery && matchesStatus;
  });

  const activeCount = jobs.filter(
    (j) => j.status === "Printing" || j.status === "Waiting" || j.status === "Pending",
  ).length;

  return (
    <AdminShell
      title="Live Print Queue"
      eyebrow={`${activeCount} active in queue`}
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setJobs([...getStoredPrintJobs()])}>
            Refresh
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Search & Status Filter Controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search order #, PDF, or student phone..."
              className="h-9.5 bg-card pl-9 text-xs"
            />
          </div>

          <div className="flex overflow-x-auto rounded-lg border border-border bg-card p-0.5 shadow-xs">
            {["all", "Pending", "Waiting", "Printing", "Ready", "Completed"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-3 py-1 text-xs font-semibold capitalize whitespace-nowrap transition-all ${
                  statusFilter.toLowerCase() === s.toLowerCase()
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Queue Table */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="hidden grid-cols-[80px_1fr_90px_100px_90px_110px_130px] gap-4 border-b border-border bg-secondary/50 px-5 py-3 text-xs font-semibold text-muted-foreground md:grid">
            <span>Order</span>
            <span>Document</span>
            <span>Type</span>
            <span>Pages</span>
            <span>Pickup</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-border">
            {filteredJobs.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No print jobs match your filter.
              </div>
            ) : (
              filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className="grid gap-3 p-4 transition-colors hover:bg-secondary/30 md:grid-cols-[80px_1fr_90px_100px_90px_110px_130px] md:items-center md:px-5"
                >
                  <span className="font-mono text-xs font-bold text-foreground">#{job.id}</span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">{job.file}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {job.placed} · {job.student}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">{job.type}</span>
                  <span className="text-xs text-muted-foreground">
                    {job.pages} p {job.physicalSheets ? `(${job.physicalSheets} sh)` : ""} · {job.copies}x
                    {job.pagesPerSheet && job.pagesPerSheet > 1 && (
                      <span className="block text-[10px] text-emerald-600 font-semibold font-mono">
                        {job.pagesPerSheet === 4 ? "2x2 N-Up" : "2-on-1"}
                      </span>
                    )}
                    {job.orientation === "landscape" && (
                      <span className="block text-[10px] text-indigo-600 font-semibold font-mono">
                        Landscape
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-xs font-semibold text-primary">
                    {job.pickupCode}
                  </span>
                  <div>
                    <StatusBadge status={job.status} />
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    {updatingId === job.id ? (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin text-primary" /> Updating...
                      </span>
                    ) : (
                      <>
                        {job.status === "Pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] px-2 text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                            onClick={() => handleStatusChange(job.id, "Waiting")}
                          >
                            Acknowledge
                          </Button>
                        )}
                        {job.status === "Waiting" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] px-2"
                            onClick={() => handleStatusChange(job.id, "Printing")}
                          >
                            Print
                          </Button>
                        )}
                        {job.status === "Printing" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] px-2 text-primary border-primary/30"
                            onClick={() => handleStatusChange(job.id, "Ready")}
                          >
                            Ready
                          </Button>
                        )}
                        {job.status === "Ready" && (
                          <Button
                            size="sm"
                            className="h-7 text-[11px] px-2 shadow-xs"
                            onClick={() => handleStatusChange(job.id, "Completed")}
                          >
                            Collected
                          </Button>
                        )}
                        {job.status === "Failed" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="Retry"
                            onClick={() => handleStatusChange(job.id, "Waiting")}
                          >
                            <RotateCcw className="size-3.5" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function StatusBadge({ status }: { status: JobStatus }) {
  const styles: Record<JobStatus, string> = {
    Pending: "bg-amber-500/10 text-amber-600 border border-amber-500/20",
    Printing: "bg-info/10 text-info border border-info/20",
    Ready: "bg-primary/10 text-primary border border-primary/20",
    Completed: "bg-secondary text-muted-foreground border border-border",
    Waiting: "bg-warning/10 text-warning border border-warning/20",
    Paused: "bg-secondary text-muted-foreground border border-border",
    Failed: "bg-destructive/10 text-destructive border border-destructive/20",
    Purged: "bg-secondary text-muted-foreground border border-border",
  };

  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${styles[status]}`}>
      {status}
    </span>
  );
}
