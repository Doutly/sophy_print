# Sophy Print — College Smart Print System

Welcome to **Sophy Print**, a full-stack, cloud-connected autonomous printing platform designed for campus copy centers and xerox shops.

The entire process is automated:

1. **Students** upload their documents from their phone or laptop, configure settings, and receive a secure pickup code.
2. **Firebase** securely stores the file and manages the live queue in Firestore.
3. **Windows Print Gateway Agent** running on the shop's computer listens to the queue, downloads the files, and routes them directly to the physical printers without staff intervention.
4. **Physical Printers** (Dual Canon imageRUNNER ADVANCE 4545i III for High-Speed B&W Xerox over LAN, Epson L5290 for Precision Colour) execute the print jobs automatically.

---

## 🔐 Admin Dashboard Access

The administrative dashboard provides full control over live queues, machine telemetry, cost-saving storage management, and revenue analytics.

- **Admin Login Portal URL:** `/admin`
- **Admin Email:** `Sophyra18@gmail.com`
- **Admin Password:** `181818`

> **Note on Authentication:** Authentication is handled securely via Firebase Authentication. On first login, if the account does not yet exist in your Firebase project, the system automatically registers the credentials and provisions admin rights.

---

## 🏗️ System Architecture & Workflow

```mermaid
graph TD
    A[Student Phone / Laptop] -->|1. Upload File & Choose Options| B[Sophy Print Web App]
    B -->|2. Upload Document| C[Firebase Cloud Storage]
    B -->|3. Create Real-Time Order| D[Firestore Database]
    D -->|4. Real-time Order Listener| E[Windows Print Gateway Agent]
    E -->|5. Auto-Download PDF| C
    E -->|6. Submit to Windows Spooler| F[Windows Print Spooler]
    F -->|B&W LAN Xerox #1| G[Canon iR-ADV 4545i III Unit 1]
    F -->|B&W LAN Xerox #2| H[Canon iR-ADV 4545i III Unit 2]
    F -->|Colour Jobs| I[Epson L5290]
    E -->|7. Mark Ready for Pickup| D
    D -->|8. Real-time Status Update| B
```

### Complete End-to-End Steps:

1. **Document Validation**: Student selects a document. The client validates the file format (accepts `.pdf`, `.docx`, `.doc`, `.pptx`, `.ppt` and rejects non-printable formats such as `.mp3`, `.mp4`, `.zip`, `.exe`).
2. **Page Count & Pricing**: The web app inspects the PDF structure client-side, calculates exact page count, applies single/double-sided options, and computes total cost.
3. **Secure Cloud Sync**: Files are placed in Firebase Cloud Storage, and order metadata is written to the `orders` Firestore collection.
4. **Autonomous Windows Agent**: The shop's computer runs the background agent (`print-agent/`). It detects newly paid orders, downloads the PDF to a temporary folder, and dispatches the file to the configured Windows printer driver via PowerShell spooler commands.
5. **Collection**: Student presents their 4-character pickup code at the counter to collect the printed papers.

---

## 🛠️ Technology Stack

- **Frontend & App Framework**: [TanStack Start](https://tanstack.com/start) + [React 19](https://react.dev) + [Vite](https://vitejs.dev)
- **Styling**: Vanilla Tailwind CSS with high-contrast light theme and accessible typography.
- **Backend & Cloud Database**: Firebase Firestore (real-time collections for `orders`, `gateways`, and `pricing`).
- **File Storage**: Firebase Cloud Storage with automated lifecycle & date-range purge capabilities.
- **Print Daemon**: Node.js Windows Background Agent (`print-agent/agent.js`) integrating with native Windows Print Spooler (`PrintTo`).
- **Testing**: [Vitest](https://vitest.dev) test suite covering routing, file validation, and order management.

---

## 🚀 Setup & Local Development Guide

### Prerequisites

- **Node.js**: v18.0.0 or later (LTS recommended)
- **npm**: v9.0.0 or later
- **Operating System**: Windows 10/11 x64 (for the Print Agent) or any OS (for the Web App)

---

### Step 1: Install Dependencies

Open your terminal in the project root directory and run:

```bash
npm install
```

### Step 2: Start the Development Web Server

Start the local development server:

```bash
npm run dev
```

Open your browser and visit:

- **Student Portal**: [http://localhost:3000](http://localhost:3000)
- **Order Tracker**: [http://localhost:3000/track](http://localhost:3000/track)
- **Admin Dashboard**: [http://localhost:3000/admin](http://localhost:3000/admin)

### Step 3: Run Verification Tests

To verify all routes, business logic, and security assertions:

```bash
npm run test
```

---

## 🖨️ Windows Print Gateway Setup Guide

The Print Gateway connects the shop's Windows computer to your live Firebase cloud print queue.

### Option A: 1-Click Browser Installer (Recommended for Shop Staff)

1. Open the Admin Dashboard: navigate to **Printers & Gateway Status** (`/admin/machines`).
2. Click **"Download Agent (.bat)"**. This downloads `Doutly-Print-Agent-Setup.bat`.
3. Move or open the `.bat` file on the shop computer and **double-click** it.
4. **Everything runs automatically**:
   - Creates a dedicated folder at `%USERPROFILE%\DoutlyPrintAgent`.
   - Checks and automatically installs Node.js LTS if not already present.
   - Unpacks all code (`agent.js`, `config.json`, `package.json`, and `start-agent.bat`).
   - Installs dependencies via `npm install`.
   - Lists all detected Windows printer names on screen for quick verification.
   - Automatically places a **"Start Doutly Print Agent"** shortcut on the Windows **Desktop**.
   - Starts listening for print jobs immediately.

### Option B: From the Source Code Repository (`print-agent/`)

1. Open the [print-agent/](file:///d:/af9ffb3c-8ac8-4e19-9db0-20d2ddaa94e3/print-agent) directory.
2. Ensure printer names in [config.json](file:///d:/af9ffb3c-8ac8-4e19-9db0-20d2ddaa94e3/print-agent/config.json) match your Windows printer names.
3. Double-click [start-agent.bat](file:///d:/af9ffb3c-8ac8-4e19-9db0-20d2ddaa94e3/print-agent/start-agent.bat) (or run `node agent.js`).
4. (Optional) Run `install-service.ps1` in PowerShell as Administrator to auto-start with Windows boot.

---

## ❓ Frequently Asked Questions

### What is the "Gateway Pair Code"?

In early prototypes, a placeholder "Pair Code" was shown in mock UI. **In the production system, no pair code is needed.** The agent connects securely and directly to the Firebase Cloud instance using the authenticated credentials in `config.json`. The web admin dashboard automatically discovers the agent via its real-time heartbeat in the `gateways` Firestore collection.

### How does the Storage Purge feature work?

Firebase Cloud Storage incurs charges if gigabytes of old student PDFs accumulate. The **Admin Storage Manager** (`/admin/storage`) lets operators select a date range (e.g. older than 7 days, 30 days, or custom) and delete files permanently from Firebase Storage with one click while keeping historical revenue records intact.

---

## 📁 Repository Structure

```
├── print-agent/                 # Windows background print agent
│   ├── agent.js                 # Print daemon & spooler bridge
│   ├── config.json              # Firebase & printer configuration
│   ├── start-agent.bat          # 1-click launcher for Windows
│   └── package.json             # Agent dependencies
├── src/
│   ├── components/              # Reusable UI components & admin shell
│   │   ├── admin-login.tsx      # Secure Firebase Auth login form
│   │   ├── admin-shell.tsx      # Responsive admin layout with live revenue
│   │   └── ui/                  # Accessible UI primitives
│   ├── lib/
│   │   ├── admin-auth.ts        # Admin authentication state & provider
│   │   ├── firebase.ts          # Firebase SDK initialization
│   │   └── print-data.ts        # Business logic, Firestore hooks & storage purger
│   ├── routes/                  # TanStack Router routes
│   │   ├── index.tsx            # Student upload & order creation portal
│   │   ├── track.tsx            # Live order tracker with pickup code
│   │   ├── admin.index.tsx      # Admin metrics & daily overview
│   │   ├── admin.queue.tsx      # Live interactive print queue
│   │   ├── admin.storage.tsx    # Firebase Storage cost-saving manager
│   │   ├── admin.machines.tsx   # Machine health & gateway telemetry
│   │   ├── admin.orders.tsx     # Order history with search & export
│   │   ├── admin.pricing.tsx    # Pricing rules editor
│   │   └── admin.revenue.tsx    # Detailed revenue breakdown
│   └── test/                    # Automated Vitest test suite
└── README.md                    # This documentation file
```
