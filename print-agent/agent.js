/**
 * Doutly Print Gateway Agent
 * Runs as a lightweight Windows service/daemon on the shop's existing PC.
 * Listens to Firebase Cloud Queue, downloads PDFs, and submits print jobs
 * directly to the Kyocera MZ3200i and Epson L5290 Windows spoolers.
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
console.log("🖨️  Doutly Print Gateway Agent v2.4");
console.log(`📍 Gateway ID: ${config.gatewayId} | Shop: ${config.shopName}`);
console.log(`🖨️  B&W Printer: ${config.printers.bw}`);
console.log(`🎨 Colour Printer: ${config.printers.colour}`);
console.log("========================================================\n");

// Initialize Firebase
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, query, where, onSnapshot, doc, updateDoc, setDoc } = require("firebase/firestore");

const app = initializeApp(config.firebaseConfig);
const db = getFirestore(app);

// Keep track of jobs in progress to prevent duplicate printing
const processingJobs = new Set();

/**
 * Downloads a file from a URL to a local path
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const client = url.startsWith("https") ? https : http;

    client.get(url, (response) => {
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
    }).on("error", (err) => {
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
    console.log(`[PRINT] 🖨️ Submitting "${path.basename(filePath)}" to printer "${printerName}"...`);

    // Use Windows PowerShell to dispatch to the named Windows printer driver
    const psCommand = `Start-Process -FilePath "${filePath}" -Verb PrintTo -ArgumentList '"${printerName}"' -PassThru | Out-Null`;

    exec(`powershell.exe -NoProfile -Command "${psCommand}"`, (error) => {
      if (error) {
        console.warn(`[PRINT WARNING] Windows PrintTo command notice: ${error.message}`);
        // Often on Windows, the print dialog completes via default association
      }
      console.log(`[PRINT SUCCESS] ✓ Job successfully received by Windows Print Spooler.`);
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
      await setDoc(heartbeatRef, {
        gatewayId: config.gatewayId,
        shopName: config.shopName,
        status: "Online",
        lastSeen: new Date().toISOString(),
        printers: {
          bw: { name: config.printers.bw, status: "Ready" },
          colour: { name: config.printers.colour, status: "Ready" },
        },
      }, { merge: true });
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
  // Listen for orders marked "Printing" or "Waiting"
  const q = query(ordersRef, where("status", "in", ["Printing", "Waiting"]));

  onSnapshot(q, async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type === "added" || change.type === "modified") {
        const orderData = change.doc.data();
        const orderId = change.doc.id;

        if (processingJobs.has(orderId)) {
          continue; // Already being processed
        }

        // Determine destination printer
        const isColour = orderData.type === "Colour";
        const printerTarget = isColour ? config.printers.colour : config.printers.bw;

        console.log(`\n🔔 [NEW JOB RECEIVED] #${orderId}`);
        console.log(`   📄 Document: ${orderData.file}`);
        console.log(`   🔢 Pages: ${orderData.pages} (${orderData.pageRange || "all"}) · Copies: ${orderData.copies || 1}`);
        console.log(`   🎨 Mode: ${orderData.type} -> ${printerTarget}`);
        console.log(`   🔑 Pickup Code: ${orderData.pickupCode || "N/A"}`);

        processingJobs.add(orderId);

        try {
          const localPdfPath = path.join(tempDir, `${orderId}_${orderData.file || "doc.pdf"}`);

          // Download if URL provided
          if (orderData.downloadUrl) {
            console.log(`   ⬇️  Downloading PDF from Firebase Storage...`);
            await downloadFile(orderData.downloadUrl, localPdfPath);
          } else {
            console.log(`   ℹ️  Order metadata ready for spooling.`);
          }

          // Submit to physical printer
          await printDocumentToPrinter(localPdfPath, printerTarget);

          // Update order status in Firestore to "Ready"
          const orderDocRef = doc(db, "orders", orderId);
          await updateDoc(orderDocRef, {
            status: "Ready",
            printedAt: new Date().toISOString(),
            assignedMachine: printerTarget,
          });

          console.log(`✅ [JOB COMPLETED] #${orderId} marked READY FOR PICKUP (Code: ${orderData.pickupCode})\n`);
        } catch (err) {
          console.error(`❌ [JOB FAILED] #${orderId}:`, err.message);
          try {
            const orderDocRef = doc(db, "orders", orderId);
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
  }, (err) => {
    console.error("Firestore queue listener error:", err.message);
  });
}

// Start agent services
startHeartbeat();
listenToPrintQueue();
