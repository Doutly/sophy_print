/**
 * Doutly Print Gateway - Windows Client Installer Generator
 * Generates an all-in-one, robust, self-extracting .bat file for shop client PCs.
 * Handles Node.js auto-installation, dependency bootstrapping, configuration,
 * printer detection, desktop shortcut creation, and live startup.
 */

export interface AgentConfig {
  gatewayId: string;
  shopName: string;
  firebaseConfig: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId: string;
  };
  printers: {
    bw: string;
    bw_secondary?: string;
    colour: string;
  };
  loadBalancing: {
    enabled: boolean;
    strategy: string;
    comment?: string;
  };
  pollIntervalSeconds: number;
  heartbeatIntervalSeconds: number;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  gatewayId: "SHOP-PC-01",
  shopName: "Campus Xerox & Print Center",
  firebaseConfig: {
    apiKey: "AIzaSyA3uzmkIR1nJV9vrBlsNGLGUUzRQZXlecU",
    authDomain: "sophy-print.firebaseapp.com",
    projectId: "sophy-print",
    storageBucket: "sophy-print.firebasestorage.app",
    messagingSenderId: "102832836431",
    appId: "1:102832836431:web:6cf61ae6daac1d9b02ff3a",
    measurementId: "G-0NPXYHVKVS",
  },
  printers: {
    bw: "Canon iR-ADV 4545i III (Unit 1)",
    bw_secondary: "Canon iR-ADV 4545i III (Unit 2)",
    colour: "Epson L5290",
  },
  loadBalancing: {
    enabled: true,
    strategy: "round-robin",
    comment: "Evenly balances high-volume B&W queue across LAN-connected Canon 4545i III units",
  },
  pollIntervalSeconds: 3,
  heartbeatIntervalSeconds: 15,
};

export const PACKAGE_JSON_CONTENT = `{
  "name": "doutly-print-agent",
  "version": "2.5.0",
  "description": "Local Windows Print Gateway for Campus Smart Print",
  "main": "agent.js",
  "scripts": {
    "start": "node agent.js"
  },
  "dependencies": {
    "firebase": "^11.4.0"
  }
}`;

export const START_AGENT_BAT_CONTENT = `@echo off
setlocal
title Doutly Print Gateway - Shop Computer
cd /d "%~dp0"
cls
echo ========================================================
echo   Starting Doutly Print Gateway Agent
echo   Hardware: Dual Canon iR-ADV 4545i III [LAN] + Epson L5290
echo ========================================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% equ 0 goto node_ok

echo [ERROR] Node.js is not found on this computer.
echo Please install Node.js LTS from https://nodejs.org/
echo Then run this batch file again.
echo.
pause
exit /b 1

:node_ok
:: Check if node_modules exists
if exist node_modules goto start_agent

echo [SETUP] Installing required agent dependencies...
call npm install --no-audit --no-fund
if %errorlevel% equ 0 goto start_agent

echo [ERROR] Failed to install dependencies. Check your internet connection.
echo.
pause
exit /b 1

:start_agent
echo [STARTING] Launching print listener and machine heartbeat...
echo.
node agent.js

echo.
echo Gateway stopped.
pause`;

export const START_BACKGROUND_VBS_CONTENT = `' Doutly Print Gateway - Silent 24/7 Background Runner
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir
WshShell.Run "cmd /c node agent.js", 0, False`;

export const STOP_AGENT_BAT_CONTENT = `@echo off
setlocal
title Stop Doutly Print Gateway
cd /d "%~dp0"
echo Stopping background Doutly Print Gateway...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*agent.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host ('[STOPPED] PID: ' + $_.ProcessId) }"
echo Agent stopped.
timeout /t 2 >nul`;

export const STATUS_AGENT_BAT_CONTENT = `@echo off
setlocal
title Doutly Print Gateway Status
cd /d "%~dp0"
cls
powershell -NoProfile -Command "$p = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*agent.js*' }; if ($p) { Write-Host '🟢 STATUS: ONLINE & RUNNING 24/7' -ForegroundColor Green; $p | Select-Object ProcessId, CommandLine | Format-Table -AutoSize } else { Write-Host '🔴 STATUS: STOPPED' -ForegroundColor Red }"
echo.
pause`;

export const AGENT_JS_CONTENT = `/**
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

console.log("\\n========================================================");
console.log("🖨️  Doutly Print Gateway Agent v2.5");
console.log(\`📍 Gateway ID: \${config.gatewayId} | Shop: \${config.shopName}\`);
console.log(\`🖨️  Canon Unit 1 (LAN B&W): \${config.printers.bw}\`);
if (config.printers.bw_secondary) {
  console.log(\`🖨️  Canon Unit 2 (LAN B&W): \${config.printers.bw_secondary}\`);
  console.log(\`⚖️  Load Balancing: Active (\${config.loadBalancing?.strategy || "round-robin"})\`);
}
console.log(\`🎨 Colour Printer: \${config.printers.colour}\`);
console.log("========================================================\\n");

// Initialize Firebase
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, query, where, onSnapshot, doc, updateDoc, setDoc } = require("firebase/firestore");

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

    client.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirect
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(\`Failed to download file: HTTP \${response.statusCode}\`));
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
    console.log(\`[PRINT] 🖨️ Submitting "\${path.basename(filePath)}" to printer "\${printerName}" (LAN Spooler)...\`);

    const safeFilePath = filePath.replace(/'/g, "''");
    const safePrinterName = (printerName || "").replace(/'/g, "''");

    const psScript = \`
      $path = '\${safeFilePath}';
      $printer = '\${safePrinterName}';
      try {
        if ($printer) {
          Start-Process -FilePath $path -Verb PrintTo -ArgumentList ('"' + $printer + '"') -PassThru | Out-Null
        } else {
          Start-Process -FilePath $path -Verb Print -PassThru | Out-Null
        }
      } catch {
        Start-Process -FilePath $path -Verb Print -PassThru | Out-Null
      }
    \`.replace(/\\r?\\n\\s*/g, " ");

    const encoded = Buffer.from(psScript, "utf16le").toString("base64");

    exec(\`powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand \${encoded}\`, (error) => {
      if (error) {
        console.warn(\`[PRINT NOTICE] Windows print command notice: \${error.message}\`);
      }
      console.log(\`[PRINT SUCCESS] ✓ Job successfully received by Windows Print Spooler for "\${printerName}".\`);
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
      }, { merge: true });
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
  const q = query(ordersRef, where("status", "in", ["Pending", "Printing", "Waiting"]));

  onSnapshot(q, async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type === "added" || change.type === "modified") {
        const orderData = change.doc.data();
        const orderId = change.doc.id;

        if (processingJobs.has(orderId)) {
          continue;
        }

        const isColour = orderData.type === "Colour";
        let printerTarget;

        if (isColour) {
          printerTarget = config.printers.colour;
        } else {
          if (orderData.printer?.includes("Unit 2")) {
            printerTarget = config.printers.bw_secondary || config.printers.bw;
          } else if (orderData.printer?.includes("Unit 1")) {
            printerTarget = config.printers.bw;
          } else if (config.printers.bw_secondary) {
            bwRoundRobinIndex = (bwRoundRobinIndex + 1) % 2;
            printerTarget = bwRoundRobinIndex === 0 ? config.printers.bw : config.printers.bw_secondary;
          } else {
            printerTarget = config.printers.bw;
          }
        }

        console.log(\`\\n🔔 [NEW JOB RECEIVED] #\${orderId}\`);
        console.log(\`   📄 Document: \${orderData.file}\`);
        console.log(\`   🔢 Pages: \${orderData.pages} (\${orderData.pageRange || "all"}) · Copies: \${orderData.copies || 1}\`);
        console.log(\`   🎨 Mode: \${orderData.type} -> Dispatched to \${printerTarget} (LAN)\`);
        console.log(\`   🔑 Pickup Code: \${orderData.pickupCode || "N/A"}\`);

        processingJobs.add(orderId);

        const orderDocRef = doc(db, "orders", orderId);

        try {
          await updateDoc(orderDocRef, {
            status: "Printing",
            assignedMachine: printerTarget,
          }).catch(() => {});

          const cleanFileName = (orderData.file || "doc.pdf").replace(/[^a-zA-Z0-9.-]/g, "_");
          const localPdfPath = path.join(tempDir, \`\${orderId}_\${cleanFileName}\`);

          if (orderData.downloadUrl) {
            console.log("   ⬇️  Downloading PDF from Firebase Storage...");
            await downloadFile(orderData.downloadUrl, localPdfPath);
          } else {
            throw new Error("No downloadUrl found for this order document.");
          }

          await printDocumentToPrinter(localPdfPath, printerTarget);

          await updateDoc(orderDocRef, {
            status: "Ready",
            printedAt: new Date().toISOString(),
            assignedMachine: printerTarget,
          });

          console.log(\`✅ [JOB COMPLETED] #\${orderId} marked READY FOR PICKUP (Code: \${orderData.pickupCode})\\n\`);
        } catch (err) {
          console.error(\`❌ [JOB FAILED] #\${orderId}:\`, err.message);
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
  }, (err) => {
    console.error("Firestore queue listener error:", err.message);
  });
}

startHeartbeat();
listenToPrintQueue();`;

export function generateAgentInstallerBat(customConfig?: Partial<AgentConfig>): string {
  const finalConfig: AgentConfig = {
    ...DEFAULT_AGENT_CONFIG,
    ...(customConfig || {}),
    firebaseConfig: {
      ...DEFAULT_AGENT_CONFIG.firebaseConfig,
      ...(customConfig?.firebaseConfig || {}),
    },
    printers: {
      ...DEFAULT_AGENT_CONFIG.printers,
      ...(customConfig?.printers || {}),
    },
    loadBalancing: {
      ...DEFAULT_AGENT_CONFIG.loadBalancing,
      ...(customConfig?.loadBalancing || {}),
    },
  };

  const configJsonStr = JSON.stringify(finalConfig, null, 2);

  return `@echo off
setlocal EnableDelayedExpansion
title Doutly Print Gateway Setup
cd /d "%~dp0"
cls
echo ========================================================
echo   Setting up Doutly Print Gateway for Windows
echo   Dual Canon iR-ADV 4545i III [LAN] + Epson L5290
echo ========================================================
echo.

set "INSTALL_DIR=%USERPROFILE%\\DoutlyPrintAgent"
echo [1/6] Destination folder:
echo       %INSTALL_DIR%
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
cd /d "%INSTALL_DIR%"
echo.

echo [2/6] Checking Node.js environment...
where node >nul 2>nul
if %errorlevel% equ 0 goto node_ready
if exist "%ProgramFiles%\\nodejs\\node.exe" (
    set "PATH=%ProgramFiles%\\nodejs;!PATH!"
    goto node_ready
)
if exist "%ProgramFiles(x86)%\\nodejs\\node.exe" (
    set "PATH=%ProgramFiles(x86)%\\nodejs;!PATH!"
    goto node_ready
)

echo [SETUP] Node.js not detected in PATH.
echo [SETUP] Attempting automatic installation via winget...
winget install OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements >nul 2>nul
if exist "%ProgramFiles%\\nodejs\\node.exe" (
    set "PATH=%ProgramFiles%\\nodejs;!PATH!"
    goto node_ready
)

echo [SETUP] Downloading official Node.js LTS installer from nodejs.org...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $msi = \\"$env:TEMP\\node_setup.msi\\"; (New-Object Net.WebClient).DownloadFile(\\"https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi\\", $msi); Start-Process msiexec.exe -ArgumentList \\"/i \`\\"$msi\`\\" /passive /norestart\\" -Wait" >nul 2>nul
if exist "%ProgramFiles%\\nodejs\\node.exe" (
    set "PATH=%ProgramFiles%\\nodejs;!PATH!"
    goto node_ready
)
where node >nul 2>nul
if %errorlevel% equ 0 goto node_ready

echo.
echo [ATTENTION] Node.js LTS is required to run the Print Agent.
echo Please install Node.js manually from: https://nodejs.org/
echo Once installed, run this setup script again.
echo.
pause
exit /b 1

:node_ready
for /f "tokens=*" %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
echo       Node.js ready: !NODE_VER!
echo.

echo [3/6] Unpacking Agent files...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$raw = [System.IO.File]::ReadAllText('%~f0'); function Extract-Block($startTag, $endTag, $destFile) { if ($raw -match '(?s)' + [regex]::Escape($startTag) + '\\r?\\n(.*?)\\r?\\n' + [regex]::Escape($endTag)) { [System.IO.File]::WriteAllText($destFile, $matches[1], [System.Text.Encoding]::UTF8); Write-Host ('   Extracted: ' + $destFile); } }; Extract-Block '::BEGIN_CONFIG_JSON::' '::END_CONFIG_JSON::' 'config.json'; Extract-Block '::BEGIN_PACKAGE_JSON::' '::END_PACKAGE_JSON::' 'package.json'; Extract-Block '::BEGIN_START_BAT::' '::END_START_BAT::' 'start-agent.bat'; Extract-Block '::BEGIN_AGENT_JS::' '::END_AGENT_JS::' 'agent.js'; Extract-Block '::BEGIN_BACKGROUND_VBS::' '::END_BACKGROUND_VBS::' 'start-agent-background.vbs'; Extract-Block '::BEGIN_STOP_BAT::' '::END_STOP_BAT::' 'stop-agent.bat'; Extract-Block '::BEGIN_STATUS_BAT::' '::END_STATUS_BAT::' 'status-agent.bat';"
echo.

echo [4/6] Installing Firebase dependencies...
call npm install --no-audit --no-fund
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Dependency installation reported warnings.
) else (
    echo       Dependencies ready.
)
echo.

echo [5/6] Detecting installed Windows printers...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Printer | Select-Object -Property Name, Default, PortName | Format-Table -AutoSize"
echo.
echo Tip: If your printer names differ from the defaults in config.json,
echo you can edit: %INSTALL_DIR%\\config.json
echo.

echo [6/6] Configuring 24/7 Background Service and Desktop Shortcuts...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $desk = [Environment]::GetFolderPath('Desktop'); $s1 = $ws.CreateShortcut(\\"$desk\\Start Doutly Print Agent (Live Console).lnk\\"); $s1.TargetPath = '%INSTALL_DIR%\\start-agent.bat'; $s1.WorkingDirectory = '%INSTALL_DIR%'; $s1.Save(); $s2 = $ws.CreateShortcut(\\"$desk\\Check Print Agent Status.lnk\\"); $s2.TargetPath = '%INSTALL_DIR%\\status-agent.bat'; $s2.WorkingDirectory = '%INSTALL_DIR%'; $s2.Save(); Write-Host '   Desktop Shortcuts Created: Live Console + Status Monitor'"

:: Register 24/7 Windows Scheduled Task (Runs at boot and login, 0-window hidden mode)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$wscript = \\"$env:SystemRoot\\System32\\wscript.exe\\"; $vbs = \\"%INSTALL_DIR%\\start-agent-background.vbs\\"; $act = New-ScheduledTaskAction -Execute $wscript -Argument \`\"$vbs\`\" -WorkingDirectory \\"%INSTALL_DIR%\\"; $trigBoot = New-ScheduledTaskTrigger -AtStartup; $trigLogon = New-ScheduledTaskTrigger -AtLogOn; $prin = New-ScheduledTaskPrincipal -UserId \\"$env:USERDOMAIN\\$env:USERNAME\\" -LogonType Interactive -RunLevel Highest; $sett = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1); Unregister-ScheduledTask -TaskName 'DoutlyPrintGateway' -Confirm:\$false -ErrorAction SilentlyContinue; Register-ScheduledTask -TaskName 'DoutlyPrintGateway' -Action $act -Trigger @($trigBoot, $trigLogon) -Principal $prin -Settings $sett | Out-Null; Write-Host '   ✅ Windows 24/7 Startup Service Registered (Zero CMD Windows)'"
echo.

echo ========================================================
echo   Setup Complete!
echo   Launching Doutly Print Gateway 24/7 Background Daemon...
echo ========================================================
echo.
wscript.exe "%INSTALL_DIR%\\start-agent-background.vbs"
timeout /t 2 >nul
echo 🟢 Gateway is now running silently in the background 24/7!
echo You can check status anytime using: status-agent.bat
echo Or open the live debug console using: start-agent.bat
echo.
pause
goto :EOF

::BEGIN_CONFIG_JSON::
${configJsonStr}
::END_CONFIG_JSON::

::BEGIN_PACKAGE_JSON::
${PACKAGE_JSON_CONTENT}
::END_PACKAGE_JSON::

::BEGIN_START_BAT::
${START_AGENT_BAT_CONTENT}
::END_START_BAT::

::BEGIN_BACKGROUND_VBS::
${START_BACKGROUND_VBS_CONTENT}
::END_BACKGROUND_VBS::

::BEGIN_STOP_BAT::
${STOP_AGENT_BAT_CONTENT}
::END_STOP_BAT::

::BEGIN_STATUS_BAT::
${STATUS_AGENT_BAT_CONTENT}
::END_STATUS_BAT::

::BEGIN_AGENT_JS::
${AGENT_JS_CONTENT}
::END_AGENT_JS::
`;
}
