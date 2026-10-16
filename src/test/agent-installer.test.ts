import { describe, it, expect } from "vitest";
import { generateAgentInstallerBat, DEFAULT_AGENT_CONFIG } from "../lib/agent-installer";
import fs from "fs";
import path from "path";

describe("Doutly Print Agent Windows Installer (.bat)", () => {
  it("generates a valid batch installer containing all components", () => {
    const batContent = generateAgentInstallerBat({
      gatewayId: "TEST-GATEWAY",
      shopName: "Test Print Shop",
    });

    expect(batContent).toContain("@echo off");
    expect(batContent).toContain("DoutlyPrintAgent");
    expect(batContent).toContain("::BEGIN_CONFIG_JSON::");
    expect(batContent).toContain("::END_CONFIG_JSON::");
    expect(batContent).toContain("::BEGIN_PACKAGE_JSON::");
    expect(batContent).toContain("::END_PACKAGE_JSON::");
    expect(batContent).toContain("::BEGIN_START_BAT::");
    expect(batContent).toContain("::END_START_BAT::");
    expect(batContent).toContain("::BEGIN_AGENT_JS::");
    expect(batContent).toContain("::END_AGENT_JS::");
    expect(batContent).toContain("::BEGIN_BACKGROUND_VBS::");
    expect(batContent).toContain("::END_BACKGROUND_VBS::");
    expect(batContent).toContain("::BEGIN_STOP_BAT::");
    expect(batContent).toContain("::END_STOP_BAT::");
    expect(batContent).toContain("::BEGIN_STATUS_BAT::");
    expect(batContent).toContain("::END_STATUS_BAT::");

    // Check custom configuration injection
    expect(batContent).toContain('"gatewayId": "TEST-GATEWAY"');
    expect(batContent).toContain('"shopName": "Test Print Shop"');
  });

  it("does not contain unescaped parenthesis syntax bugs in if blocks that cause CMD crash", () => {
    const batContent = generateAgentInstallerBat();

    // Check for the previously crashing patterns
    expect(batContent).not.toMatch(/echo [^\r\n]*\(LTS\)[^\r\n]*from/i);
    expect(batContent).not.toMatch(/echo [^\r\n]*\(LTS version\)/i);
  });

  it("validates print-agent/start-agent.bat has robust syntax and no CMD parsing crashes", () => {
    const startBatPath = path.resolve(__dirname, "../../print-agent/start-agent.bat");
    expect(fs.existsSync(startBatPath)).toBe(true);

    const content = fs.readFileSync(startBatPath, "utf-8");
    expect(content).toContain("@echo off");
    expect(content).toContain("node agent.js");
    // Ensure no unescaped (LTS version) inside if block
    expect(content).not.toContain("(LTS version)");
  });

  it("simulates batch file block extraction and confirms config.json parses with zero syntax errors", () => {
    const batContent = generateAgentInstallerBat();

    // Simulate the PowerShell extraction regex on the generated .bat
    const match = batContent.match(/::BEGIN_CONFIG_JSON::\r?\n([\s\S]*?)\r?\n::END_CONFIG_JSON::/);
    expect(match).not.toBeNull();
    const extractedConfigStr = match![1];

    // Ensure it parses cleanly with JSON.parse
    const parsed = JSON.parse(extractedConfigStr);
    expect(parsed.gatewayId).toBe("SHOP-PC-01");
    expect(parsed.printers.bw).toBe("Canon 01");
    expect(parsed.printers.colour).toBe("EPSON L5290 Series");

    // Verify UTF-8 No-BOM instruction in the batch file extractor
    expect(batContent).toContain("System.Text.UTF8Encoding($false)");
  });

  it("verifies extracted agent.js contains industrial safeguards (atomic claiming, PDF magic bytes, Sumatra engine)", () => {
    const batContent = generateAgentInstallerBat();
    const match = batContent.match(/::BEGIN_AGENT_JS::\r?\n([\s\S]*?)\r?\n::END_AGENT_JS::/);
    expect(match).not.toBeNull();
    const extractedAgentJs = match![1];

    // 1. Atomic Firestore claiming via transaction
    expect(extractedAgentJs).toContain("runTransaction");
    // 2. PDF magic bytes signature check
    expect(extractedAgentJs).toContain("%PDF-");
    // 3. SumatraPDF silent CLI engine integration
    expect(extractedAgentJs).toContain("SumatraPDF.exe");
    // 4. BOM stripping on config load
    expect(extractedAgentJs).toContain("0xfeff");
  });
});

