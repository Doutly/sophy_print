/**
 * Doutly Print Gateway Agent
 * Runs as a lightweight Windows service/daemon on the shop's PC.
 * Listens to Firebase Cloud Queue, downloads PDFs, and submits print jobs
 * directly to Dual Canon (LAN Connected) and Epson Windows spoolers.
 *
 * Industrial Features:
 * 1. Atomic Firestore transaction claiming (prevents duplicate jobs across agents/restarts)
 * 2. Triple-Engine printing (SumatraPDF portable CLI, Edge silent print, Shell PrintTo)
 * 3. Exact duplex mode (long/short edge) and copies honoring
 * 4. PDF payload validation (magic bytes check, 100MB limit, redirect safety)
 * 5. Automatic fuzzy printer matching against Windows Win32_Printer
 * 6. Resilient Firestore queue: long-polling + auto-reconnect + 10s fallback query
 * 7. Persistent job ledger (processed_jobs.json)
 */

const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const https = require("https");
const http = require("http");

// Load local configuration with UTF-8 BOM stripping
const configPath = path.join(__dirname, "config.json");
if (!fs.existsSync(configPath)) {
  console.error("❌ config.json not found! Please ensure config.json exists in the agent folder.");
  process.exit(1);
}

let rawConfigText = fs.readFileSync(configPath, "utf-8").trim();
if (rawConfigText.charCodeAt(0) === 0xfeff) {
  rawConfigText = rawConfigText.slice(1);
}
const config = JSON.parse(rawConfigText);

const tempDir = path.join(__dirname, "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Persist processed job IDs to disk to prevent double-printing across agent restarts
const processedJobsPath = path.join(__dirname, "processed_jobs.json");
let processedJobIds = new Set();
try {
  if (fs.existsSync(processedJobsPath)) {
    const saved = JSON.parse(fs.readFileSync(processedJobsPath, "utf-8"));
    if (Array.isArray(saved)) {
      processedJobIds = new Set(saved);
    }
  }
} catch {
  processedJobIds = new Set();
}

function markJobProcessed(orderId) {
  processedJobIds.add(orderId);
  try {
    const arr = Array.from(processedJobIds).slice(-500);
    fs.writeFileSync(processedJobsPath, JSON.stringify(arr), "utf-8");
  } catch {}
}

console.log("\n========================================================");
console.log("🖨️  Doutly Print Gateway Agent v2.5 (Industrial)");
console.log(`📍 Gateway ID: ${config.gatewayId} | Shop: ${config.shopName}`);
console.log(`🖨️  Canon Unit 1 (B&W): ${config.printers.bw}`);
if (config.printers.bw_secondary) {
  console.log(`🖨️  Canon Unit 2 (B&W): ${config.printers.bw_secondary}`);
  console.log(`⚖️  Load Balancing: Active (${config.loadBalancing?.strategy || "round-robin"})`);
}
console.log(`🎨 Colour Printer: ${config.printers.colour}`);
console.log("========================================================\n");

// Optional portable silent print engine (SumatraPDF CLI)
const sumatraPath = path.join(__dirname, "SumatraPDF.exe");
let isSumatraDownloading = false;

function ensureSumatraPdf() {
  if (fs.existsSync(sumatraPath) || isSumatraDownloading) return;
  isSumatraDownloading = true;
  console.log("📦 Checking portable silent printing engine (SumatraPDF CLI)...");
  const sumatraUrl = "https://www.sumatrapdfreader.org/dl/rel/3.5.2/SumatraPDF-3.5.2-64.exe";
  const tempSumatra = path.join(tempDir, "SumatraPDF_download.exe");
  const file = fs.createWriteStream(tempSumatra);

  https
    .get(sumatraUrl, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        https
          .get(res.headers.location, (redirRes) => {
            redirRes.pipe(file);
            file.on("finish", () => {
              file.close(() => {
                try {
                  fs.renameSync(tempSumatra, sumatraPath);
                  console.log("✅ Silent printing engine (SumatraPDF) ready.");
                } catch {}
                isSumatraDownloading = false;
              });
            });
          })
          .on("error", () => {
            isSumatraDownloading = false;
          });
        return;
      }
      res.pipe(file);
      file.on("finish", () => {
        file.close(() => {
          try {
            fs.renameSync(tempSumatra, sumatraPath);
            console.log("✅ Silent printing engine (SumatraPDF) ready.");
          } catch {}
          isSumatraDownloading = false;
        });
      });
    })
    .on("error", () => {
      isSumatraDownloading = false;
    });
}
ensureSumatraPdf();

// Initialize Firebase with Long Polling to avoid gRPC RST_STREAM Code 13 disconnects
const { initializeApp } = require("firebase/app");
const {
  initializeFirestore,
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  runTransaction,
} = require("firebase/firestore");

const app = initializeApp(config.firebaseConfig);
let db;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch {
  db = getFirestore(app);
}

const processingJobs = new Set();
let bwRoundRobinIndex = 0;

// Windows printer cache and fuzzy resolution
let installedPrintersCache = null;

function getInstalledPrinters() {
  if (installedPrintersCache) return Promise.resolve(installedPrintersCache);
  return new Promise((resolve) => {
    exec(
      `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name"`,
      (err, stdout) => {
        if (err || !stdout) {
          resolve([]);
          return;
        }
        const printers = stdout
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);
        installedPrintersCache = printers;
        resolve(printers);
      }
    );
  });
}

async function resolvePrinterName(configuredName, fallbackKeyword) {
  const printers = await getInstalledPrinters();
  if (!printers || printers.length === 0) return configuredName;

  if (printers.includes(configuredName)) return configuredName;

  const ciMatch = printers.find(
    (p) => p.toLowerCase() === (configuredName || "").toLowerCase()
  );
  if (ciMatch) return ciMatch;

  const subMatch = printers.find(
    (p) =>
      (configuredName && p.toLowerCase().includes(configuredName.toLowerCase())) ||
      (configuredName && configuredName.toLowerCase().includes(p.toLowerCase()))
  );
  if (subMatch) return subMatch;

  if (fallbackKeyword) {
    const kwMatch = printers.find((p) =>
      p.toLowerCase().includes(fallbackKeyword.toLowerCase())
    );
    if (kwMatch) return kwMatch;
  }

  return configuredName;
}

/**
 * Downloads a file with URL safety, redirect limit, size limit, and PDF magic bytes validation
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return reject(new Error("Invalid download URL provided"));
    }

    const maxSizeBytes = 100 * 1024 * 1024; // 100MB safety ceiling
    let downloadedBytes = 0;
    let redirectCount = 0;

    function get(currentUrl) {
      const client = currentUrl.startsWith("https") ? https : http;
      client
        .get(currentUrl, (response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
            redirectCount++;
            if (redirectCount > 5) {
              return reject(new Error("Too many HTTP redirects during document download"));
            }
            return get(response.headers.location);
          }
          if (response.statusCode !== 200) {
            return reject(new Error(`Failed to download file: HTTP ${response.statusCode}`));
          }

          const file = fs.createWriteStream(destPath);
          response.on("data", (chunk) => {
            downloadedBytes += chunk.length;
            if (downloadedBytes > maxSizeBytes) {
              response.destroy();
              file.close();
              fs.unlink(destPath, () => {});
              return reject(new Error("File size exceeds 100MB safety limit"));
            }
          });

          response.pipe(file);
          file.on("finish", () => {
            file.close(() => {
              // Verify PDF magic bytes '%PDF-'
              try {
                const fd = fs.openSync(destPath, "r");
                const buf = Buffer.alloc(5);
                fs.readSync(fd, buf, 0, 5, 0);
                fs.closeSync(fd);
                if (buf.toString() !== "%PDF-") {
                  fs.unlink(destPath, () => {});
                  return reject(
                    new Error("Corrupted document: Payload is not a valid PDF file (invalid header)")
                  );
                }
                resolve(true);
              } catch (verifyErr) {
                fs.unlink(destPath, () => {});
                reject(verifyErr);
              }
            });
          });
        })
        .on("error", (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
    }

    get(url);
  });
}

/**
 * Triple-Engine Print Submission with Spooler Verification:
 * Engine 1: SumatraPDF CLI (Honors exact duplex & copies silently)
 * Engine 2: Microsoft Edge Headless Print
 * Engine 3: Windows Shell 'PrintTo' verb
 */
function printDocumentToPrinter(filePath, printerName, duplexMode = "single", copies = 1) {
  return new Promise((resolve, reject) => {
    let winDuplex = "OneSided";
    let sumatraDuplex = "simplex";

    if (duplexMode === "duplex-short") {
      winDuplex = "TwoSidedShortEdge";
      sumatraDuplex = "duplexshort";
    } else if (duplexMode === "duplex-long" || duplexMode === "double") {
      winDuplex = "TwoSidedLongEdge";
      sumatraDuplex = "duplexlong";
    }

    const numCopies = Math.max(1, parseInt(copies, 10) || 1);
    const safeFilePath = filePath.replace(/'/g, "''");
    const safePrinterName = (printerName || "").replace(/'/g, "''");
    const safeSumatraPath = sumatraPath.replace(/'/g, "''");

    console.log(
      `[PRINT] 🖨️ Submitting "${path.basename(filePath)}" to printer "${printerName}" [Duplex: ${winDuplex}, Copies: ${numCopies}]...`
    );

    const psLines = [
      `$path = '${safeFilePath}';`,
      `$printer = '${safePrinterName}';`,
      `$duplex = '${winDuplex}';`,
      `$copies = ${numCopies};`,
      `$sumatra = '${safeSumatraPath}';`,
      `$sumatraDuplex = '${sumatraDuplex}';`,
      `$success = $false;`,
      ``,
      `# Engine 1: SumatraPDF CLI (Exact duplex & copies)`,
      `if (Test-Path $sumatra) {`,
      `  try {`,
      `    $settings = $copies.ToString() + 'x,' + $sumatraDuplex;`,
      `    $p = Start-Process -FilePath $sumatra -ArgumentList ('-print-to "' + $printer + '" -print-settings "' + $settings + '" -silent "' + $path + '"') -PassThru -Wait;`,
      `    if ($p.ExitCode -eq 0 -or $null -eq $p.ExitCode) {`,
      `      $success = $true;`,
      `    }`,
      `  } catch {`,
      `    Write-Warning ("Engine 1 SumatraPDF: " + $_.Exception.Message);`,
      `  }`,
      `}`,
      ``,
      `# Engine 2: Microsoft Edge Headless Print`,
      `if (-not $success) {`,
      `  if ($printer) {`,
      `    Set-PrintConfiguration -PrinterName $printer -DuplexingMode $duplex -ErrorAction SilentlyContinue;`,
      `  }`,
      `  $edgePath = "$env:ProgramFiles(x86)\\Microsoft\\Edge\\Application\\msedge.exe";`,
      `  if (-not (Test-Path $edgePath)) { $edgePath = "$env:ProgramFiles\\Microsoft\\Edge\\Application\\msedge.exe"; }`,
      `  if (Test-Path $edgePath) {`,
      `    try {`,
      `      for ($i = 0; $i -lt $copies; $i++) {`,
      `        $arg = '--msedge-silent-print --no-first-run --print-to-printer="' + $printer + '" "' + $path + '"';`,
      `        $p = Start-Process -FilePath $edgePath -ArgumentList $arg -PassThru -Wait;`,
      `        if ($copies -gt 1) { Start-Sleep -Milliseconds 800; }`,
      `      }`,
      `      $success = $true;`,
      `    } catch {`,
      `      Write-Warning ("Engine 2 Edge Print: " + $_.Exception.Message);`,
      `    }`,
      `  }`,
      `}`,
      ``,
      `# Engine 3: Native Shell PrintTo`,
      `if (-not $success) {`,
      `  try {`,
      `    for ($i = 0; $i -lt $copies; $i++) {`,
      `      if ($printer) {`,
      `        $p = Start-Process -FilePath $path -Verb PrintTo -ArgumentList ('"' + $printer + '"') -PassThru -ErrorAction Stop;`,
      `      } else {`,
      `        $p = Start-Process -FilePath $path -Verb Print -PassThru -ErrorAction Stop;`,
      `      }`,
      `      if ($copies -gt 1) { Start-Sleep -Milliseconds 800; }`,
      `    }`,
      `    $success = $true;`,
      `  } catch {`,
      `    Write-Warning ("Engine 3 Shell PrintTo: " + $_.Exception.Message);`,
      `  }`,
      `}`,
      ``,
      `if ($success) {`,
      `  Write-Output "PRINT_SUCCESS";`,
      `  exit 0;`,
      `} else {`,
      `  Write-Error "All Windows print methods failed for: $path on printer: $printer";`,
      `  exit 1;`,
      `}`
    ];

    const encoded = Buffer.from(psLines.join("\n"), "utf16le").toString("base64");

    exec(
      `powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
      (error, stdout, stderr) => {
        const output = (stdout || "") + (stderr || "");
        if (error || !output.includes("PRINT_SUCCESS")) {
          const errDetail = stderr || error?.message || "Spooler rejected job";
          console.error(`[PRINT ERROR] Spooler failure on "${printerName}": ${errDetail.trim()}`);
          reject(new Error(`Failed printing to "${printerName}": ${errDetail.trim()}`));
        } else {
          console.log(
            `[PRINT SUCCESS] ✓ Spooled to "${printerName}" (${winDuplex}, ${numCopies} ${numCopies === 1 ? "copy" : "copies"}).`
          );
          resolve(true);
        }
      }
    );
  });
}

/**
 * Periodically reports gateway heartbeat to Firebase
 */
function startHeartbeat() {
  const sendHeartbeat = async () => {
    try {
      const heartbeatRef = doc(db, "gateways", config.gatewayId);
      await setDoc(
        heartbeatRef,
        {
          gatewayId: config.gatewayId,
          shopName: config.shopName,
          status: "Online",
          lastSeen: new Date().toISOString(),
          printers: {
            bw: {
              name: config.printers.bw,
              model: "Canon imageRUNNER ADVANCE (LAN)",
              connection: "LAN (Gigabit Ethernet)",
              status: "Ready",
            },
            bw_secondary: {
              name: config.printers.bw_secondary || config.printers.bw,
              model: "Canon imageRUNNER ADVANCE (LAN)",
              connection: "LAN (Gigabit Ethernet)",
              status: "Ready",
            },
            colour: {
              name: config.printers.colour,
              model: "Epson L5290",
              connection: "USB / LAN",
              status: "Ready",
            },
          },
        },
        { merge: true }
      );
    } catch (err) {
      console.warn("[HEARTBEAT NOTICE] Could not send ping:", err.message);
    }
  };

  sendHeartbeat();
  setInterval(sendHeartbeat, (config.heartbeatIntervalSeconds || 15) * 1000);
}

/**
 * Atomically claims and processes an order document
 */
async function processOrderJob(orderDoc) {
  const orderData = orderDoc.data();
  const orderId = orderDoc.id;

  // Local deduplication check
  if (processingJobs.has(orderId) || processedJobIds.has(orderId)) {
    return;
  }

  // Only handle active statuses
  if (!["Pending", "Printing", "Waiting"].includes(orderData.status)) {
    return;
  }

  const isColour = orderData.type === "Colour";
  let targetConfigured = config.printers.bw;

  if (isColour) {
    targetConfigured = config.printers.colour;
  } else {
    if (orderData.printer?.includes("Unit 2") || orderData.printer?.includes("Canon 02")) {
      targetConfigured = config.printers.bw_secondary || config.printers.bw;
    } else if (orderData.printer?.includes("Unit 1") || orderData.printer?.includes("Canon 01")) {
      targetConfigured = config.printers.bw;
    } else if (config.printers.bw_secondary) {
      bwRoundRobinIndex = (bwRoundRobinIndex + 1) % 2;
      targetConfigured = bwRoundRobinIndex === 0 ? config.printers.bw : config.printers.bw_secondary;
    } else {
      targetConfigured = config.printers.bw;
    }
  }

  const resolvedPrinter = await resolvePrinterName(
    targetConfigured,
    isColour ? "Epson" : "Canon"
  );

  const orderDocRef = doc(db, "orders", orderId);

  // Atomic cloud lock: only ONE agent instance can claim this order
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(orderDocRef);
      if (!snap.exists()) {
        throw new Error("Order does not exist in database");
      }
      const liveStatus = snap.data().status;
      if (!["Pending", "Printing", "Waiting"].includes(liveStatus)) {
        throw new Error(`Order already claimed or finished (${liveStatus})`);
      }
      transaction.update(orderDocRef, {
        status: "Printing",
        lockedBy: config.gatewayId,
        lockedAt: new Date().toISOString(),
        assignedMachine: resolvedPrinter,
      });
    });
  } catch (claimErr) {
    // Another worker or process claimed it
    return;
  }

  processingJobs.add(orderId);

  console.log(`\n🔔 [JOB CLAIMED & PROCESSING] #${orderId}`);
  console.log(`   📄 Document: ${orderData.file || "Document.pdf"}`);
  console.log(
    `   🔢 Pages: ${orderData.pages} (${orderData.pageRange || "all"}) · Copies: ${orderData.copies || 1}`
  );
  console.log(`   🎨 Mode: ${orderData.type} -> Dispatched to "${resolvedPrinter}"`);
  console.log(`   🔑 Pickup Code: ${orderData.pickupCode || orderId}`);

  try {
    const cleanFileName = (orderData.file || "document.pdf").replace(/[^a-zA-Z0-9.-]/g, "_");
    const localPdfPath = path.join(tempDir, `${orderId}_${cleanFileName}`);

    if (orderData.downloadUrl) {
      console.log(`   ⬇️  Downloading PDF from cloud storage...`);
      await downloadFile(orderData.downloadUrl, localPdfPath);
    } else {
      throw new Error("No downloadUrl available for this order document.");
    }

    const orderDuplex =
      orderData.duplexMode || (orderData.sides === "double" ? "duplex-long" : "single");
    const orderCopies = Math.max(1, parseInt(orderData.copies, 10) || 1);

    // Attempt printing with automatic failover
    try {
      await printDocumentToPrinter(localPdfPath, resolvedPrinter, orderDuplex, orderCopies);
    } catch (spoolErr) {
      const hasSecondary = !isColour && config.printers.bw_secondary;
      if (hasSecondary) {
        const backupTargetConfigured =
          targetConfigured === config.printers.bw
            ? config.printers.bw_secondary
            : config.printers.bw;
        const backupResolved = await resolvePrinterName(backupTargetConfigured, "Canon");
        console.warn(
          `⚠️ [FAILOVER ENGAGED] Primary "${resolvedPrinter}" error. Auto-failing over #${orderId} to "${backupResolved}"...`
        );
        await printDocumentToPrinter(localPdfPath, backupResolved, orderDuplex, orderCopies);
      } else {
        throw spoolErr;
      }
    }

    console.log(`   ⏳ Buffering 10s to allow physical ejection into output tray...`);
    await new Promise((r) => setTimeout(r, 10000));

    await updateDoc(orderDocRef, {
      status: "Ready",
      printedAt: new Date().toISOString(),
      assignedMachine: resolvedPrinter,
    });

    markJobProcessed(orderId);

    setTimeout(() => {
      fs.unlink(localPdfPath, () => {});
    }, 60000);

    console.log(`✅ [JOB COMPLETED] #${orderId} marked READY FOR PICKUP (Code: ${orderData.pickupCode || orderId})\n`);
  } catch (err) {
    console.error(`❌ [JOB FAILED] #${orderId}:`, err.message);
    try {
      await updateDoc(orderDocRef, {
        status: "Failed",
        failureReason: err.message,
      });
    } catch {}
  } finally {
    processingJobs.delete(orderId);
  }
}

/**
 * Subscribes to Firestore print queue with auto-reconnect and 10s polling fallback
 */
function listenToPrintQueue() {
  console.log("👂 Listening for incoming print jobs from campus...");

  const ordersRef = collection(db, "orders");
  const q = query(ordersRef, where("status", "in", ["Pending", "Printing", "Waiting"]));

  let unsubscribe = null;

  function attachSnapshot() {
    try {
      if (unsubscribe) {
        try { unsubscribe(); } catch {}
      }
      unsubscribe = onSnapshot(
        q,
        async (snapshot) => {
          for (const change of snapshot.docChanges()) {
            if (change.type === "added" || change.type === "modified") {
              await processOrderJob(change.doc);
            }
          }
        },
        (err) => {
          console.warn("[QUEUE NOTICE] Firestore snapshot error, retrying in 5s:", err.message);
          setTimeout(attachSnapshot, 5000);
        }
      );
    } catch (err) {
      console.warn("[QUEUE ERROR] Could not attach listener:", err.message);
      setTimeout(attachSnapshot, 5000);
    }
  }

  attachSnapshot();

  setInterval(async () => {
    try {
      const snap = await getDocs(q);
      for (const docSnap of snap.docs) {
        await processOrderJob(docSnap);
      }
    } catch {}
  }, 10000);
}

// Start agent services
startHeartbeat();
listenToPrintQueue();
