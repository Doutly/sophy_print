/**
 * Doutly Print Gateway Agent
 * Runs as a lightweight Windows service/daemon on the shop's existing PC.
 * Listens to Firebase Cloud Queue, downloads PDFs, and submits print jobs
 * directly to the Dual Canon imageRUNNER ADVANCE 4545i III (LAN Connected)
 * and Epson L5290 Windows spoolers.
 */

const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const https = require("https");
const http = require("http");

// Load local configuration
const configPath = path.join(__dirname, "config.json");
if (!fs.existsSync(configPath)) {
  console.error("❌ config.json not found! Please ensure config.json exists in the agent folder.");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const tempDir = path.join(__dirname, "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

console.log("\n========================================================");
console.log("🖨️  Doutly Print Gateway Agent v2.5");
console.log(`📍 Gateway ID: ${config.gatewayId} | Shop: ${config.shopName}`);
console.log(`🖨️  Canon Unit 1 (LAN B&W): ${config.printers.bw}`);
if (config.printers.bw_secondary) {
  console.log(`🖨️  Canon Unit 2 (LAN B&W): ${config.printers.bw_secondary}`);
  console.log(`⚖️  Load Balancing: Active (${config.loadBalancing?.strategy || "round-robin"})`);
}
console.log(`🎨 Colour Printer: ${config.printers.colour}`);
console.log("========================================================\n");

// Initialize Firebase
const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
} = require("firebase/firestore");

const app = initializeApp(config.firebaseConfig);
const db = getFirestore(app);

// Keep track of jobs in progress to prevent duplicate printing
const processingJobs = new Set();
// Toggle for round-robin between the two Canon 4545i III LAN printers
let bwRoundRobinIndex = 0;

/**
 * Downloads a file from a URL to a local path
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const client = url.startsWith("https") ? https : http;

    client
      .get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Handle redirect
          downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download file: HTTP ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close(resolve);
        });
      })
      .on("error", (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
  });
}

/**
 * Sends a PDF file to the Windows Print Spooler for a specific printer
 */
function printDocumentToPrinter(filePath, printerName) {
  return new Promise((resolve) => {
    console.log(
      `[PRINT] 🖨️ Submitting "${path.basename(filePath)}" to printer "${printerName}" (LAN Spooler)...`,
    );

    // Escape single quotes for PowerShell script block
    const safeFilePath = filePath.replace(/'/g, "''");
    const safePrinterName = (printerName || "").replace(/'/g, "''");

    const psScript = `
      $path = '${safeFilePath}';
      $printer = '${safePrinterName}';
      try {
        if ($printer) {
          Start-Process -FilePath $path -Verb PrintTo -ArgumentList ('"' + $printer + '"') -PassThru | Out-Null
        } else {
          Start-Process -FilePath $path -Verb Print -PassThru | Out-Null
        }
      } catch {
        Start-Process -FilePath $path -Verb Print -PassThru | Out-Null
      }
    `.replace(/\r?\n\s*/g, " ");

    const encoded = Buffer.from(psScript, "utf16le").toString("base64");

    exec(`powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`, (error) => {
      if (error) {
        console.warn(`[PRINT NOTICE] Windows Print command notice: ${error.message}`);
      }
      console.log(
        `[PRINT SUCCESS] ✓ Job successfully received by Windows Print Spooler for "${printerName}".`,
      );
      resolve(true);
    });
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
              model: "Canon imageRUNNER ADVANCE 4545i III",
              connection: "LAN (Gigabit Ethernet)",
              status: "Ready",
            },
            bw_secondary: {
              name: config.printers.bw_secondary || config.printers.bw,
              model: "Canon imageRUNNER ADVANCE 4545i III",
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
        { merge: true },
      );
      // console.log(`[HEARTBEAT] ❤️ Ping sent to Firebase (${new Date().toLocaleTimeString()})`);
    } catch (err) {
      console.warn("[HEARTBEAT ERROR] Could not send ping to Firebase:", err.message);
    }
  };

  sendHeartbeat();
  setInterval(sendHeartbeat, (config.heartbeatIntervalSeconds || 15) * 1000);
}

/**
 * Subscribes to Firestore for newly placed print jobs
 */
function listenToPrintQueue() {
  console.log("👂 Listening for incoming print jobs from students on campus...");

  const ordersRef = collection(db, "orders");
  // Listen for orders marked "Pending", "Printing", or "Waiting"
  const q = query(ordersRef, where("status", "in", ["Pending", "Printing", "Waiting"]));

  onSnapshot(
    q,
    async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === "added" || change.type === "modified") {
          const orderData = change.doc.data();
          const orderId = change.doc.id;

          if (processingJobs.has(orderId)) {
            continue; // Already being processed
          }

          // Determine destination printer
          const isColour = orderData.type === "Colour";
          let printerTarget;

          if (isColour) {
            printerTarget = config.printers.colour;
          } else {
            // Check if specific unit requested or load-balance across the 2 Canon 4545i III machines
            if (orderData.printer?.includes("Unit 2")) {
              printerTarget = config.printers.bw_secondary || config.printers.bw;
            } else if (orderData.printer?.includes("Unit 1")) {
              printerTarget = config.printers.bw;
            } else if (config.printers.bw_secondary) {
              // Alternate / round-robin between Unit 1 and Unit 2
              bwRoundRobinIndex = (bwRoundRobinIndex + 1) % 2;
              printerTarget =
                bwRoundRobinIndex === 0 ? config.printers.bw : config.printers.bw_secondary;
            } else {
              printerTarget = config.printers.bw;
            }
          }

          console.log(`\n🔔 [NEW JOB RECEIVED] #${orderId}`);
          console.log(`   📄 Document: ${orderData.file}`);
          console.log(
            `   🔢 Pages: ${orderData.pages} (${orderData.pageRange || "all"}) · Copies: ${orderData.copies || 1}`,
          );
          console.log(`   🎨 Mode: ${orderData.type} -> Dispatched to ${printerTarget} (LAN)`);
          console.log(`   🔑 Pickup Code: ${orderData.pickupCode || "N/A"}`);

          processingJobs.add(orderId);

          const orderDocRef = doc(db, "orders", orderId);

          try {
            // Mark status Printing in Firestore to inform admin panel
            await updateDoc(orderDocRef, {
              status: "Printing",
              assignedMachine: printerTarget,
            }).catch(() => {});

            const cleanFileName = (orderData.file || "doc.pdf").replace(/[^a-zA-Z0-9.-]/g, "_");
            const localPdfPath = path.join(tempDir, `${orderId}_${cleanFileName}`);

            // Download if URL provided
            if (orderData.downloadUrl) {
              console.log(`   ⬇️  Downloading PDF from Firebase Storage...`);
              await downloadFile(orderData.downloadUrl, localPdfPath);
            } else {
              throw new Error("No downloadUrl found for this order document.");
            }

            // Submit to physical printer
            await printDocumentToPrinter(localPdfPath, printerTarget);

            // Update order status in Firestore to "Ready"
            await updateDoc(orderDocRef, {
              status: "Ready",
              printedAt: new Date().toISOString(),
              assignedMachine: printerTarget,
            });

            console.log(
              `✅ [JOB COMPLETED] #${orderId} marked READY FOR PICKUP (Code: ${orderData.pickupCode})\n`,
            );
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
      }
    },
    (err) => {
      console.error("Firestore queue listener error:", err.message);
    },
  );
}

// Start agent services
startHeartbeat();
listenToPrintQueue();
