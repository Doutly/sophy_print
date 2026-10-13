import { Link } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  CircleDollarSign,
  FileClock,
  Gauge,
  HardDrive,
  LogOut,
  Menu,
  Printer,
  Settings2,
  ShieldCheck,
  UserCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AdminLogin } from "@/components/admin-login";
import { Button } from "@/components/ui/button";
import { useAdminAuth } from "@/lib/admin-auth";
import { getStoredPrintJobs, subscribeToOrders, type PrintJob } from "@/lib/print-data";

interface NavItem {
  label: string;
  to:
    | "/admin"
    | "/admin/queue"
    | "/admin/storage"
    | "/admin/machines"
    | "/admin/orders"
    | "/admin/pricing"
    | "/admin/revenue";
  icon: LucideIcon;
}

const adminNav: NavItem[] = [
  { label: "Overview", to: "/admin", icon: Gauge },
  { label: "Live queue", to: "/admin/queue", icon: Activity },
  { label: "Storage", to: "/admin/storage", icon: HardDrive },
  { label: "Machines", to: "/admin/machines", icon: Printer },
  { label: "Orders", to: "/admin/orders", icon: FileClock },
  { label: "Pricing", to: "/admin/pricing", icon: Settings2 },
  { label: "Revenue", to: "/admin/revenue", icon: BarChart3 },
];

export function AdminShell({
  title,
  eyebrow,
  children,
  action,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { user, loading, logout } = useAdminAuth();
  const [jobs, setJobs] = useState<PrintJob[]>(getStoredPrintJobs());

  useEffect(() => {
    return subscribeToOrders((liveJobs) => setJobs(liveJobs));
  }, []);

  const todayRevenue = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return jobs
      .filter((job) => {
        const jobTime = job.createdAt ? new Date(job.createdAt).getTime() : 0;
        return jobTime >= todayStart;
      })
      .reduce((acc, j) => acc + (j.amount || 0), 0);
  }, [jobs]);

  // 1. Loading State
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-3">
          <div className="mx-auto size-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Verifying Admin Session…
          </p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State -> Show In-Place Admin Login Screen
  if (!user) {
    return <AdminLogin />;
  }

  // 3. Authenticated Admin Dashboard
  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20">
      {/* Mobile Sidebar backdrop */}
      {open && (
        <button
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-xs lg:hidden"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-card/95 backdrop-blur-md p-4 transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0 shadow-xl" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Brand header */}
          <div className="flex h-14 items-center justify-between px-2">
            <Link
              to="/"
              className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight text-foreground"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                <Printer className="size-4.5" />
              </span>
              <span>
                Sophy <span className="text-primary font-bold">Print</span>
              </span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X className="size-4" />
            </Button>
          </div>

          <p className="px-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Shop Operations
          </p>

          {/* Navigation links */}
          <nav className="mt-2 space-y-1">
            {adminNav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.to === "/admin" }}
                  onClick={() => setOpen(false)}
                  className="flex h-10.5 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-all duration-150 hover:bg-secondary hover:text-foreground"
                  activeProps={{
                    className: "bg-primary/10 text-primary font-semibold shadow-xs",
                  }}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Admin User Profile & Sign Out Footer */}
          <div className="mt-auto space-y-3">
            <div className="rounded-xl border border-border bg-secondary/40 p-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-primary shrink-0">
                    <ShieldCheck className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {user.email || "Sophyra18@gmail.com"}
                    </p>
                    <p className="text-[10px] text-primary font-bold uppercase">Admin Role</p>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => logout()}
                className="mt-2.5 w-full h-8 text-xs gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/30"
              >
                <LogOut className="size-3.5" />
                Sign Out
              </Button>
            </div>

            <div className="rounded-lg border border-border/80 bg-card p-2 text-center">
              <p className="text-[10px] text-muted-foreground">
                Firebase Auth & Cloud Spooler Active
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content view */}
      <main className="lg:pl-64">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-xl">
          <div className="flex min-h-18 items-center gap-4 px-5 sm:px-8">
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                {eyebrow}
              </p>
              <h1 className="truncate font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {title}
              </h1>
            </div>
            {action}
            <div className="hidden items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground sm:flex">
              <CircleDollarSign className="size-4 text-primary" />
              <span>₹{todayRevenue.toLocaleString("en-IN")} today</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              title="Sign Out of Admin"
              className="hidden sm:flex text-muted-foreground hover:text-destructive text-xs gap-1"
            >
              <LogOut className="size-3.5" />
              Sign Out
            </Button>
          </div>
        </header>

        {/* View container */}
        <div className="mx-auto max-w-[1440px] p-5 sm:p-8">{children}</div>
      </main>
    </div>
  );
}
