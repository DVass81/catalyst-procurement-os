import { afterEach, describe, expect, it, vi } from "vitest";

import { scanPrivateDocumentContent } from "@/server/security/document-scanner";

const originalEnvironment = {
  documentMode: process.env.CATALYST_DOCUMENT_SCAN_MODE,
  dlpMode: process.env.CATALYST_DLP_SCAN_MODE,
  zeroRetention: process.env.CATALYST_MALWARE_SCANNER_ZERO_RETENTION,
  url: process.env.CATALYST_MALWARE_SCANNER_URL,
  secret: process.env.CATALYST_MALWARE_SCANNER_SECRET,
};

function setLiveScannerEnvironment() {
  process.env.CATALYST_DOCUMENT_SCAN_MODE = "live";
  process.env.CATALYST_DLP_SCAN_MODE = "live";
  process.env.CATALYST_MALWARE_SCANNER_ZERO_RETENTION = "1";
  process.env.CATALYST_MALWARE_SCANNER_URL =
    "https://scanner.creditunion.example/v1/scan";
  process.env.CATALYST_MALWARE_SCANNER_SECRET = "scanner-test-secret";
}

function restoreEnvironment(
  key: string,
  value: string | undefined,
) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  restoreEnvironment(
    "CATALYST_DOCUMENT_SCAN_MODE",
    originalEnvironment.documentMode,
  );
  restoreEnvironment("CATALYST_DLP_SCAN_MODE", originalEnvironment.dlpMode);
  restoreEnvironment(
    "CATALYST_MALWARE_SCANNER_ZERO_RETENTION",
    originalEnvironment.zeroRetention,
  );
  restoreEnvironment("CATALYST_MALWARE_SCANNER_URL", originalEnvironment.url);
  restoreEnvironment(
    "CATALYST_MALWARE_SCANNER_SECRET",
    originalEnvironment.secret,
  );
  vi.unstubAllGlobals();
});

describe("private document security scanner", () => {
  it("uses a clearly labeled simulation only when live scanning is not required", async () => {
    await expect(
      scanPrivateDocumentContent({
        bytes: Buffer.from("fictional evidence"),
        sha256: "a".repeat(64),
        detectedMime: "text/csv",
        filename: "fictional.csv",
        liveRequired: false,
      }),
    ).resolves.toMatchObject({
      mode: "simulated",
      result: "clean",
    });
  });

  it("accepts a live clean malware and DLP result", async () => {
    setLiveScannerEnvironment();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "clean",
            dlpStatus: "clear",
            engine: "qualified-private-scanner",
            signatureVersion: "2026.07.29",
            scannedAt: "2026-07-29T20:00:00.000Z",
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(
      scanPrivateDocumentContent({
        bytes: Buffer.from("approved pilot procurement evidence"),
        sha256: "b".repeat(64),
        detectedMime: "application/pdf",
        filename: "approved.pdf",
        liveRequired: true,
      }),
    ).resolves.toMatchObject({
      mode: "live",
      result: "clean",
      metadata: {
        engine: "qualified-private-scanner",
      },
    });
  });

  it("rejects malware, prohibited data, and incomplete live configuration", async () => {
    setLiveScannerEnvironment();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "clean",
            dlpStatus: "prohibited_data",
            engine: "qualified-private-scanner",
            signatureVersion: "2026.07.29",
            scannedAt: "2026-07-29T20:00:00.000Z",
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(
      scanPrivateDocumentContent({
        bytes: Buffer.from("prohibited"),
        sha256: "c".repeat(64),
        detectedMime: "application/pdf",
        filename: "prohibited.pdf",
        liveRequired: true,
      }),
    ).rejects.toThrow("DOCUMENT_PROHIBITED_DATA_REJECTED");

    delete process.env.CATALYST_DLP_SCAN_MODE;
    await expect(
      scanPrivateDocumentContent({
        bytes: Buffer.from("unscanned"),
        sha256: "d".repeat(64),
        detectedMime: "application/pdf",
        filename: "unscanned.pdf",
        liveRequired: true,
      }),
    ).rejects.toThrow("DOCUMENT_SCAN_CONFIGURATION_MISSING");
  });
});
