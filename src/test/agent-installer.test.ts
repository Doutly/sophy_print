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
});
