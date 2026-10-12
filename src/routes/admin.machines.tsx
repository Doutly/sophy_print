import { createFileRoute } from "@tanstack/react-router";
import { Activity, Clock3, Download, Printer, Server, ShieldCheck, Cpu } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import { defaultPrinters, getStoredPrintJobs, subscribeToOrders, type PrintJob } from "@/lib/print-data";

export const Route = createFileRoute("/admin/machines")({
  head: () => ({
    meta: [
      { title: "Machines & Print Agent — Sophy Print" },
      { name: "description", content: "Printer status and Windows Doutly Print Agent installer." },
      { property: "og:title", content: "Machines & Print Agent — Sophy Print" },
      { property: "og:description", content: "Download Doutly Print Agent and monitor Dual Canon imageRUNNER ADVANCE 4545i III & Epson hardware." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MachinesPage,
});

interface GatewayData {
  gatewayId: string;
  shopName: string;
  status: string;
  lastSeen?: string;
  printers?: {
    bw?: { name: string; status: string; connection?: string };
    bw_secondary?: { name: string; status: string; connection?: string };
    colour?: { name: string; status: string; connection?: string };
  };
}

function MachinesPage() {
  const [jobs, setJobs] = useState<PrintJob[]>(getStoredPrintJobs());
  const [gateway, setGateway] = useState<GatewayData | null>(null);

  useEffect(() => {
    const unsubOrders = subscribeToOrders((liveJobs) => {
      setJobs(liveJobs);
    });

    const unsubGateway = onSnapshot(doc(db, "gateways", "SHOP-PC-01"), (docSnap) => {
      if (docSnap.exists()) {
        setGateway(docSnap.data() as GatewayData);
      } else {
        setGateway(null);
      }
    });

    return () => {
      unsubOrders();
      unsubGateway();
    };
  }, []);

  const isGatewayActive = useMemo(() => {
    if (!gateway?.lastSeen) return false;
    const lastTime = new Date(gateway.lastSeen).getTime();
    const diffSec = (Date.now() - lastTime) / 1000;
    return diffSec < 60; // Active within 60 seconds
  }, [gateway]);

  const lastSeenLabel = useMemo(() => {
    if (!gateway?.lastSeen) return "Standby (No heartbeat yet)";
    const diffSec = Math.max(1, Math.round((Date.now() - new Date(gateway.lastSeen).getTime()) / 1000));
    if (diffSec < 60) return `Active (${diffSec}s ago)`;
    const diffMin = Math.round(diffSec / 60);
    return `Last seen ${diffMin}m ago`;
  }, [gateway]);

  const downloadAgentPackage = () => {
    const installerBatContent = `@echo off
title Doutly Print Gateway Setup
cls
echo ========================================================
echo   Setting up Doutly Print Gateway for Windows
echo ========================================================
echo.

if not exist "%~dp0doutly-agent" mkdir "%~dp0doutly-agent"
cd /d "%~dp0doutly-agent"

echo [1/3] Writing configuration file...
(
echo {
echo   "gatewayId": "SHOP-PC-01",
echo   "shopName": "Campus Xerox ^& Print Center",
echo   "firebaseConfig": {
echo     "apiKey": "AIzaSyA3uzmkIR1nJV9vrBlsNGLGUUzRQZXlecU",
echo     "authDomain": "sophy-print.firebaseapp.com",
echo     "projectId": "sophy-print",
echo     "storageBucket": "sophy-print.firebasestorage.app",
echo     "messagingSenderId": "102832836431",
echo     "appId": "1:102832836431:web:6cf61ae6daac1d9b02ff3a",
echo     "measurementId": "G-0NPXYHVKVS"
echo   },
echo   "printers": {
echo     "bw": "Canon iR-ADV 4545i III (Unit 1)",
echo     "bw_secondary": "Canon iR-ADV 4545i III (Unit 2)",
echo     "colour": "Epson L5290"
echo   },
echo   "loadBalancing": {
echo     "enabled": true,
echo     "strategy": "round-robin"
echo   },
echo   "pollIntervalSeconds": 3,
echo   "heartbeatIntervalSeconds": 15
echo }
) > config.json

echo [2/3] Writing package.json...
(
echo {
echo   "name": "doutly-print-agent",
echo   "version": "2.4.0",
echo   "dependencies": {
echo     "firebase": "^11.4.0"
echo   }
echo }
) > package.json

echo [3/3] Checking Node.js environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [NOTICE] Node.js not found. Please install Node.js (LTS) from https://nodejs.org/
    echo Then run start-agent.bat
    pause
    exit /b
)

if not exist node_modules (
    echo Installing Firebase client...
    call npm install --no-audit --no-fund
)

echo.
echo ========================================================
echo   Setup Complete!
echo   Run "node agent.js" inside print-agent/ to start service.
echo ========================================================
echo.
pause
`;

    const blob = new Blob([installerBatContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Doutly-Print-Agent-Setup.bat";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell
      title="Printers & Gateway Status"
      eyebrow="Hardware Environment"
      action={
        <Button size="sm" onClick={downloadAgentPackage} className="gap-1.5 shadow-xs">
          <Download className="size-3.5" />
          Download Agent Setup (.bat)
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Gateway Service Status Banner */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                <Server className="size-6" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display font-bold text-lg text-foreground">
                    Doutly Print Gateway (Windows Background Agent)
                  </h2>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary uppercase">
                    v2.4
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                  Listens to the cloud Firebase queue, automatically downloads student PDFs, and
                  submits print jobs to Dual Canon imageRUNNER ADVANCE 4545i III (LAN) and Epson spoolers with zero staff intervention.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Activity className={`size-3.5 ${isGatewayActive ? "text-emerald-500" : "text-muted-foreground"}`} />
                    <span className={isGatewayActive ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>
                      Heartbeat: {lastSeenLabel}
                    </span>
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-mono text-muted-foreground">Gateway ID: SHOP-PC-01</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
              <Button size="lg" onClick={downloadAgentPackage} className="gap-2 shadow-xs w-full sm:w-auto">
                <Download className="size-4" />
                Download Agent (.bat)
              </Button>
            </div>
          </div>
        </section>

        {/* Physical Printer Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {defaultPrinters.map((machine) => {
            const machineJobs = jobs.filter(
              (j) =>
                j.printer?.includes(machine.name) ||
                (machine.type === "bw"
                  ? j.type === "B&W" || j.printer?.includes("Canon")
                  : j.type === "Colour" || j.printer?.includes("Epson"))
            );
            const inQueue = machineJobs.filter((j) => j.status === "Printing" || j.status === "Waiting").length;
            const completedJobs = machineJobs.filter((j) => j.status === "Completed" || j.status === "Ready").length;

            return (
              <article key={machine.name} className="flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-xs">
                <div>
                  <div className="flex items-start justify-between">
                    <span className="grid size-12 place-items-center rounded-xl bg-secondary text-foreground">
                      <Printer className="size-5" />
                    </span>
                    <span
                      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                        isGatewayActive
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                          : "border-border bg-secondary/50 text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`size-2 rounded-full ${
                          isGatewayActive ? "bg-emerald-500 shadow-xs" : "bg-muted-foreground"
                        }`}
                      />
                      {isGatewayActive ? "Online & Ready" : "Standby (Agent Offline)"}
                    </span>
                  </div>

                  <div className="mt-5 flex items-center gap-2">
                    <h2 className="font-display text-lg font-bold tracking-tight text-foreground">{machine.name}</h2>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{machine.role}</p>

                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[11px] font-semibold text-secondary-foreground">
                      {machine.connection}
                    </span>
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                      {machine.speed}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2 border-y border-border py-4 text-center">
                    <Metric label="Jobs recorded" value={machineJobs.length} />
                    <Metric label="In queue" value={inQueue} />
                    <Metric label="Completed" value={completedJobs} />
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock3 className="size-3.5 text-primary" />
                    {isGatewayActive ? "Windows Spooler: Connected" : "Windows Spooler: Awaiting Agent"}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground truncate" title={machine.driver}>
                    <Cpu className="size-3 shrink-0" />
                    <span className="truncate">{machine.driver}</span>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-display text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}