import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  HardDrive,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DocumentPreviewModal } from "@/components/document-preview-modal";
import {
  deleteOrderCompletely,
  fetchFirestoreOrders,
  purgeFileFromStorage,
  purgeFilesByDateRange,
  subscribeToOrders,
  type PrintJob,
} from "@/lib/print-data";

export const Route = createFileRoute("/admin/storage")({
  head: () => ({
    meta: [
      { title: "Storage Manager — Sophy Print" },
      {
        name: "description",
        content:
          "Manage uploaded student print files and bulk-purge old files to reduce Firebase Storage costs.",
      },
      { property: "og:title", content: "Storage Manager — Sophy Print" },
      {
        property: "og:description",
        content: "Student uploaded files and Firebase Storage cost optimization.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StorageManagerPage,
});

function StorageManagerPage() {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "purged">("all");

  // Date range state (default from 30 days ago to today)
  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0]!;
  }, []);

  const defaultTo = useMemo(() => {
    return new Date().toISOString().split("T")[0]!;
  }, []);

  const [startDate, setStartDate] = useState(defaultFrom);
  const [endDate, setEndDate] = useState(defaultTo);
  const [purging, setPurging] = useState(false);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [previewJob, setPreviewJob] = useState<PrintJob | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Subscribe to live Firestore orders
  useEffect(() => {
    const unsubscribe = subscribeToOrders((liveJobs) => {
      setJobs(liveJobs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter jobs based on search query, status filter, and optional date range
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesQuery = `${job.id} ${job.file} ${job.student} ${job.pickupCode || ""}`
        .toLowerCase()
        .includes(query.toLowerCase());

      const isActive = Boolean(job.storagePath || job.downloadUrl) && !job.isPurged;
      const isPurged = Boolean(job.isPurged) || (!job.storagePath && !job.downloadUrl);

      let matchesStatus = true;
      if (statusFilter === "active") matchesStatus = isActive;
      if (statusFilter === "purged") matchesStatus = isPurged;

      return matchesQuery && matchesStatus;
    });
  }, [jobs, query, statusFilter]);

  // Jobs matching selected date range for bulk purge
  const rangeMatchingJobs = useMemo(() => {
    const start = new Date(startDate).setHours(0, 0, 0, 0);
    const end = new Date(endDate).setHours(23, 59, 59, 999);

    return jobs.filter((job) => {
      const hasPhysicalFile =
        (Boolean(job.storagePath) || Boolean(job.downloadUrl)) && !job.isPurged;
      if (!hasPhysicalFile) return false;
      const jobTime = job.createdAt ? new Date(job.createdAt).getTime() : 0;
      return jobTime >= start && jobTime <= end;
    });
  }, [jobs, startDate, endDate]);

  // Overall Storage Statistics
  const stats = useMemo(() => {
    const totalOrders = jobs.length;
    const activeStoredFiles = jobs.filter(
      (j) => (j.storagePath || j.downloadUrl) && !j.isPurged,
    ).length;
    const purgedFiles = jobs.filter((j) => j.isPurged).length;
    // Estimated average 1.8 MB per uploaded multi-page document
    const estimatedSavedMB = (purgedFiles * 1.8).toFixed(1);

    return { totalOrders, activeStoredFiles, purgedFiles, estimatedSavedMB };
  }, [jobs]);

  // Handle single file purge
  const handleSinglePurge = async (job: PrintJob) => {
    if (
      !window.confirm(
        `Purge physical file for order #${job.id} ("${job.file}") from Firebase Storage? This will reduce cloud storage costs while preserving revenue accounting.`,
      )
    ) {
      return;
    }

    try {
      await purgeFileFromStorage(job.id, job.storagePath);
      setActionMessage({
        type: "success",
        text: `Successfully purged "${job.file}" from Firebase Storage. Storage space freed.`,
      });
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || "Failed to purge file.",
      });
    }
  };

  // Handle bulk purge by date range
  const handleBulkPurge = async () => {
    if (rangeMatchingJobs.length === 0) {
      alert("No active files found in the selected date range to purge.");
      return;
    }

    const confirmMsg = `Are you sure you want to purge ${rangeMatchingJobs.length} active files between ${startDate} and ${endDate}?
    
• Physical files will be completely deleted from Firebase Storage to eliminate storage fees.
• Financial & order history records in Firestore will be retained for accounting.`;

    if (!window.confirm(confirmMsg)) return;

    setPurging(true);
    setActionMessage(null);
    try {
      const result = await purgeFilesByDateRange(startDate, endDate);
      setActionMessage({
        type: "success",
        text: `Purged ${result.purgedCount} file(s) from Firebase Storage. Storage costs reduced!`,
      });
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || "Bulk purge failed.",
      });
    } finally {
      setPurging(false);
    }
  };

  // Handle hard delete of entire record
  const handleHardDelete = async (job: PrintJob) => {
    if (
      !window.confirm(
        `Permanently delete order #${job.id} and its file completely from Firestore and Storage? This cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await deleteOrderCompletely(job.id, job.storagePath);
      setActionMessage({
        type: "success",
        text: `Order #${job.id} completely deleted from database.`,
      });
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || "Delete failed.",
      });
    }
  };

  return (
    <AdminShell
      title="Storage & File Manager"
      eyebrow="Cost Optimization & Retention"
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setLoading(true);
              const data = await fetchFirestoreOrders();
              setJobs(data);
              setLoading(false);
            }}
            className="gap-1.5 shadow-xs"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Sync Storage
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Status notification */}
        {actionMessage && (
          <div
            className={`flex items-center justify-between rounded-xl border p-4 text-xs font-semibold shadow-xs ${
              actionMessage.type === "success"
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.type === "success" ? (
                <CheckCircle2 className="size-4 shrink-0" />
              ) : (
                <AlertTriangle className="size-4 shrink-0" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="text-xs opacity-75 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Top Cost & Capacity Stat Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <FileText className="size-4" />
              </span>
              <span className="text-xs font-semibold text-primary">Real-time</span>
            </div>
            <p className="mt-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Uploads
            </p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
              {stats.totalOrders}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <HardDrive className="size-4" />
              </span>
              <span className="text-xs font-semibold text-emerald-600">In Cloud</span>
            </div>
            <p className="mt-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active Stored Files
            </p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
              {stats.activeStoredFiles}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-lg bg-blue-500/10 text-blue-600">
                <Check className="size-4" />
              </span>
              <span className="text-xs font-semibold text-blue-600">Zero Cost</span>
            </div>
            <p className="mt-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Purged Files
            </p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
              {stats.purgedFiles}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
                <ShieldAlert className="size-4" />
              </span>
              <span className="text-xs font-semibold text-amber-600">Saved</span>
            </div>
            <p className="mt-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Storage Capacity Saved
            </p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
              ~{stats.estimatedSavedMB} MB
            </p>
          </div>
        </div>

        {/* DATE RANGE SELECTION & COST-SAVING BULK PURGE CARD */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4 mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
                <Calendar className="size-4 text-primary" />
                Date Range Storage Purge
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Delete physical storage files in bulk for a date range to stay inside Firebase's
                free tier and eliminate storage fees.
              </p>
            </div>
            <span className="rounded-full bg-secondary/80 px-2.5 py-1 text-xs font-medium text-muted-foreground w-fit">
              {rangeMatchingJobs.length} active files match range
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1.5">
              <label htmlFor="purge-from" className="text-xs font-semibold text-foreground">
                From Date
              </label>
              <Input
                id="purge-from"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 text-xs bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="purge-to" className="text-xs font-semibold text-foreground">
                To Date
              </label>
              <Input
                id="purge-to"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 text-xs bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Action Type</span>
              <div className="h-10 flex items-center text-xs text-muted-foreground font-medium rounded-lg border border-border px-3 bg-secondary/30">
                Purge Storage Blobs (Keep Order Records)
              </div>
            </div>

            <Button
              type="button"
              disabled={purging || rangeMatchingJobs.length === 0}
              onClick={handleBulkPurge}
              className="h-10 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-semibold gap-1.5 shadow-xs"
            >
              <Trash2 className="size-3.5" />
              {purging ? "Purging Files…" : `Purge ${rangeMatchingJobs.length} Files in Range`}
            </Button>
          </div>
        </section>

        {/* FILES TABLE & SEARCH */}
        <section className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="flex flex-col gap-3 p-5 border-b border-border sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search file, student, or order ID…"
                className="pl-9 h-9 text-xs bg-background"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Filter:</span>
              <div className="flex rounded-lg border border-border bg-secondary/30 p-0.5">
                {(["all", "active", "purged"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setStatusFilter(mode)}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-all capitalize ${
                      statusFilter === mode
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Files List */}
          {filteredJobs.length === 0 ? (
            <div className="p-12 text-center">
              <HardDrive className="mx-auto size-10 text-muted-foreground/40 mb-3" />
              <p className="font-display font-semibold text-foreground text-sm">No files found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {query || statusFilter !== "all"
                  ? "No uploaded documents match your current search or filter criteria."
                  : "When students upload PDFs or documents for printing, they will appear here with complete CRUD controls."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/30 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                    <th className="px-5 py-3">Document & Order</th>
                    <th className="px-5 py-3">Student & Date</th>
                    <th className="px-5 py-3">Pages & Mode</th>
                    <th className="px-5 py-3">Storage Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredJobs.map((job) => {
                    const isCloudStored =
                      Boolean(job.storagePath || job.downloadUrl) && !job.isPurged;

                    return (
                      <tr key={job.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-foreground">
                          <div className="flex items-center gap-2.5">
                            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                              <FileText className="size-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold max-w-xs">{job.file}</p>
                              <p className="text-[11px] text-muted-foreground">Order #{job.id}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-muted-foreground">
                          <p className="font-medium text-foreground">{job.student}</p>
                          <p className="text-[11px]">
                            {job.placed} ·{" "}
                            {job.createdAt
                              ? new Date(job.createdAt).toLocaleDateString()
                              : "Recent"}
                          </p>
                        </td>

                        <td className="px-5 py-3.5 text-muted-foreground">
                          <p className="font-semibold text-foreground">
                            {job.pages} p · {job.copies} {job.copies === 1 ? "copy" : "copies"}
                          </p>
                          <p className="text-[11px]">
                            {job.type} ({job.printer || "Standard"})
                          </p>
                        </td>

                        <td className="px-5 py-3.5">
                          {isCloudStored ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              Active in Storage
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                              <span className="size-1.5 rounded-full bg-muted-foreground" />
                              File Purged (₹0 Cost)
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPreviewJob(job);
                                setPreviewOpen(true);
                              }}
                              className="h-8 gap-1 text-[11px] shadow-xs"
                              title="Preview document in-browser without downloading"
                            >
                              <Eye className="size-3" /> Preview
                            </Button>

                            {job.downloadUrl && !job.isPurged ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setPreviewJob(job);
                                  setPreviewOpen(true);
                                }}
                                className="h-8 gap-1 text-[11px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 shadow-xs"
                                title="Push document to Student Template Gallery"
                              >
                                <Sparkles className="size-3" /> Push to Gallery
                              </Button>
                            ) : null}

                            {isCloudStored ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSinglePurge(job)}
                                className="h-8 gap-1 text-[11px] text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 shadow-xs"
                                title="Purge file from Firebase Storage to eliminate storage cost"
                              >
                                <Trash2 className="size-3" /> Purge File
                              </Button>
                            ) : null}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleHardDelete(job)}
                              className="h-8 gap-1 text-[11px] text-destructive hover:bg-destructive/10"
                              title="Delete completely from Firestore"
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <DocumentPreviewModal
        job={previewJob}
        isOpen={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewJob(null);
        }}
        onPushedToGallery={(tpl) => {
          setActionMessage({
            type: "success",
            text: `Document pushed to Student Template Gallery: "${tpl.title}"!`,
          });
        }}
      />
    </AdminShell>
  );
}
