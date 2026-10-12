# Doutly Print Gateway — Windows Shop Computer Setup

This agent connects the shop's existing Windows PC to the Sophy Print cloud queue. It automatically downloads paid student PDFs and dispatches them to the **Dual Canon imageRUNNER ADVANCE 4545i III** (High-Speed B&W LAN Xerox Copiers) and **Epson L5290** (Colour) printer spoolers.

---

## 🚀 Quick Start (Under 1 Minute)

1. Ensure **Node.js** is installed on this PC (Download from https://nodejs.org if needed).
2. Double-click `start-agent.bat`.
3. The script will automatically install dependencies and start listening for paid print jobs.

---

## ⚙️ Hardware & Configuration (`config.json`)

The shop operates **two identical Canon imageRUNNER ADVANCE 4545i III** multifunction machines connected over LAN (Ethernet/TCP-IP):

```json
{
  "gatewayId": "SHOP-PC-01",
  "shopName": "Campus Xerox & Print Center",
  "printers": {
    "bw": "Canon iR-ADV 4545i III (Unit 1)",
    "bw_secondary": "Canon iR-ADV 4545i III (Unit 2)",
    "colour": "Epson L5290"
  },
  "loadBalancing": {
    "enabled": true,
    "strategy": "round-robin"
  }
}
```

### Windows Printer Name Verification:
1. Open **Settings > Bluetooth & devices > Printers & scanners** in Windows.
2. Verify both Canon LAN network printers are installed (e.g. using the Canon Generic Plus UFR II or PCL6 driver).
3. If they are named differently (e.g. `Canon iR-ADV 4545i III`), ensure the names in `config.json` match exactly.
4. When `loadBalancing` is enabled, the agent automatically alternates incoming B&W print jobs between Unit 1 and Unit 2 to distribute wear and keep the line moving fast!

---

## 🔄 Automatic Windows Boot Startup (Optional)

To ensure the agent starts silently every time Windows turns on:
1. Right-click `install-service.ps1`.
2. Select **Run with PowerShell** (or run as Administrator in PowerShell).
3. The gateway is now registered as an auto-recovering Windows service!
