# Doutly Print Gateway — Windows Shop Computer Setup

This agent connects the shop's existing Windows PC to the Sophy Print cloud queue. It automatically downloads paid student PDFs and dispatches them to the **KYOCERA TASKalfa MZ3200i** (B&W) and **Epson L5290** (Colour) printer spoolers.

---

## 🚀 Quick Start (Under 1 Minute)

1. Ensure **Node.js** is installed on this PC (Download from https://nodejs.org if needed).
2. Double-click `start-agent.bat`.
3. The script will automatically install dependencies and start listening for paid print jobs.

---

## ⚙️ Configuration (`config.json`)

Ensure your Windows printer names match your actual Windows Devices & Printers list:
- `printers.bw`: `"Kyocera MZ3200i"` (or your exact Windows printer driver name)
- `printers.colour`: `"Epson L5290"`

---

## 🔄 Automatic Windows Boot Startup (Optional)

To ensure the agent starts silently every time Windows turns on:
1. Right-click `install-service.ps1`.
2. Select **Run with PowerShell** (or run as Administrator in PowerShell).
3. The gateway is now registered as an auto-recovering Windows service!
