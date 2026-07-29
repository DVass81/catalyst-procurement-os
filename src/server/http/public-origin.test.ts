import { describe, expect, it } from "vitest";

import { resolvePublicOrigin } from "@/server/http/public-origin";

describe("resolvePublicOrigin", () => {
  it("prefers the configured public application URL", () => {
    const request = new Request("http://web-internal:3000/auth/callback", {
      headers: {
        "x-forwarded-host": "proxy.example.test",
        "x-forwarded-proto": "https",
      },
    });

    expect(
      resolvePublicOrigin(
        request,
        "https://catalyst-phase3-staging-aj3de.ondigitalocean.app/path",
      ),
    ).toBe("https://catalyst-phase3-staging-aj3de.ondigitalocean.app");
  });

  it("uses validated proxy headers when no application URL is configured", () => {
    const request = new Request("http://web-internal:3000/auth/callback", {
      headers: {
        "x-forwarded-host": "catalyst.example.test",
        "x-forwarded-proto": "https",
      },
    });

    expect(resolvePublicOrigin(request, "")).toBe(
      "https://catalyst.example.test",
    );
  });

  it("rejects unsafe configuration and forwarded hosts", () => {
    const request = new Request("https://safe.example.test/auth/callback", {
      headers: {
        "x-forwarded-host": "attacker.example/path",
        "x-forwarded-proto": "https",
      },
    });

    expect(resolvePublicOrigin(request, "javascript:alert(1)")).toBe(
      "https://safe.example.test",
    );
  });
});
