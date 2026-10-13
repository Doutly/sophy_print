import { createFileRoute } from "@tanstack/react-router";
import { Download, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getStoredPrintJobs, subscribeToOrders, type PrintJob } from "@/lib/print-data";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({
    meta: [
      { title: "Order History — Sophy Print" },
      { name: "description", content: "Search Sophy Print order history." },
      { property: "og:title", content: "Order History — Sophy Print" },
      { property: "og:description", content: "Search print orders and payment status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const [query, setQuery] = useState("");
  const [allJobs, setAllJobs] = useState<PrintJob[]>(getStoredPrintJobs());

  useEffect(() => {
    const unsubscribe = subscribeToOrders((liveJobs) => {
      setAllJobs(liveJobs);
    });
    return () => unsubscribe();
  }, []);

  const jobs = useMemo(() => {
    return allJobs.filter((j) =>
      `${j.id} ${j.file} ${j.student} ${j.pickupCode || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  }, [allJobs, query]);

  const exportOrdersCSV = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Order,Document,Pages,Copies,Student,Placed,Amount,PickupCode,Status\n" +
      jobs
        .map(
          (j) =>
            `${j.id},${j.file},${j.pages},${j.copies},${j.student},${j.placed},${j.amount},${j.pickupCode || ""},${j.status}`,
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sophy_print_orders.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AdminShell
      title="Order History"
      eyebrow={`${allJobs.length} orders recorded`}
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={exportOrdersCSV}
          disabled={jobs.length === 0}
          className="gap-1.5 shadow-xs"
        >
          <Download className="size-3.5" />
          Export Orders
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order ID, document name, or student phone..."
            className="h-9.5 bg-card pl-9 text-xs"
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
          {jobs.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              <p className="font-semibold text-foreground text-sm">No orders found</p>
              <p className="mt-1">
                {query
                  ? "No orders match your search query."
                  : "Zero orders in queue. New student orders appear here live."}
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/50 text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="p-4">Order</th>
                  <th className="p-4">Document</th>
                  <th className="p-4">Student</th>
                  <th className="p-4">Placed</th>
                  <th className="p-4">Pickup</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Payment</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobs.map((job) => (
                  <tr key={job.id} className="transition-colors hover:bg-secondary/30">
                    <td className="p-4 font-mono font-bold text-foreground">#{job.id}</td>
                    <td className="p-4 font-medium text-foreground">
                      <div>{job.file}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {job.type} · {job.pages} pages
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">{job.student}</td>
                    <td className="p-4 text-muted-foreground text-xs">{job.placed}</td>
                    <td className="p-4 font-mono text-xs font-semibold text-primary">
                      {job.pickupCode}
                    </td>
                    <td className="p-4 font-semibold text-foreground">₹{job.amount}</td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          job.status === "Completed"
                            ? "bg-primary/10 text-primary"
                            : "bg-amber-500/10 text-amber-600"
                        }`}
                      >
                        {job.status === "Completed" ? "Paid" : "Pay at counter"}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="rounded-md border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-foreground">
                        {job.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
