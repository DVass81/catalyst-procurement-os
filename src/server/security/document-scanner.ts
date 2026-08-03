import "server-only";

import { z } from "zod";

const liveScanResponseSchema = z.object({
  status: z.enum(["clean", "infected", "error"]),
  dlpStatus: z.enum(["clear", "prohibited_data", "error"]),
  engine: z.string().trim().min(1).max(120),
  signatureVersion: z.string().trim().min(1).max(120),
  scannedAt: z.string().datetime({ offset: true }),
});

export interface DocumentScanResult {
  mode: "simulated" | "live";
  result: "clean";
  metadata: {
    engine: string;
    signatureVersion: string;
    scannedAt: string;
  };
}

function configuredScannerUrl() {
  const configured = process.env.CATALYST_MALWARE_SCANNER_URL;
  if (!configured) throw new Error("DOCUMENT_SCAN_CONFIGURATION_MISSING");
  const url = new URL(configured);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
  ) {
    throw new Error("DOCUMENT_SCAN_CONFIGURATION_INVALID");
  }
  return url;
}

export async function scanPrivateDocumentContent(input: {
  bytes: Buffer;
  sha256: string;
  detectedMime: string;
  filename: string;
  liveRequired: boolean;
}): Promise<DocumentScanResult> {
  if (!input.liveRequired) {
    return {
      mode: "simulated",
      result: "clean",
      metadata: {
        engine: "catalyst-labeled-simulation",
        signatureVersion: "not-applicable",
        scannedAt: new Date().toISOString(),
      },
    };
  }
  if (
    process.env.CATALYST_DOCUMENT_SCAN_MODE !== "live" ||
    process.env.CATALYST_DLP_SCAN_MODE !== "live" ||
    process.env.CATALYST_MALWARE_SCANNER_ZERO_RETENTION !== "1" ||
    !process.env.CATALYST_MALWARE_SCANNER_SECRET
  ) {
    throw new Error("DOCUMENT_SCAN_CONFIGURATION_MISSING");
  }
  const response = await fetch(configuredScannerUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CATALYST_MALWARE_SCANNER_SECRET}`,
      "Content-Type": "application/octet-stream",
      "X-Catalyst-Content-Sha256": input.sha256,
      "X-Catalyst-Detected-Mime": input.detectedMime,
      "X-Catalyst-Filename": encodeURIComponent(input.filename),
      "X-Catalyst-Retention": "none",
    },
    body: Uint8Array.from(input.bytes).buffer,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  }).catch((error: unknown) => {
    throw new Error("DOCUMENT_SCAN_FAILED", { cause: error });
  });
  if (!response.ok) throw new Error("DOCUMENT_SCAN_FAILED");
  const parsed = liveScanResponseSchema.safeParse(
    await response.json().catch(() => null),
  );
  if (
    !parsed.success ||
    parsed.data.status === "error" ||
    parsed.data.dlpStatus === "error"
  ) {
    throw new Error("DOCUMENT_SCAN_FAILED");
  }
  if (parsed.data.status === "infected") {
    throw new Error("DOCUMENT_MALWARE_REJECTED");
  }
  if (parsed.data.dlpStatus === "prohibited_data") {
    throw new Error("DOCUMENT_PROHIBITED_DATA_REJECTED");
  }
  return {
    mode: "live",
    result: "clean",
    metadata: {
      engine: parsed.data.engine,
      signatureVersion: parsed.data.signatureVersion,
      scannedAt: parsed.data.scannedAt,
    },
  };
}
