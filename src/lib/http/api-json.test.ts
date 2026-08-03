import { describe, expect, it } from "vitest";

import { CatalystApiError, readApiJson } from "@/lib/http/api-json";

describe("readApiJson", () => {
  it("accepts successful JSON responses", async () => {
    const response = Response.json({ status: "ok" });

    await expect(readApiJson(response, "Fallback")).resolves.toEqual({
      status: "ok",
    });
  });

  it("rejects HTML without attempting JSON parsing", async () => {
    const response = new Response("<!DOCTYPE html><title>Error</title>", {
      status: 500,
      headers: {
        "Content-Type": "text/html",
        "X-Catalyst-Correlation-Id": "correlation-html-response",
      },
    });

    await expect(readApiJson(response, "Fallback")).rejects.toMatchObject({
      name: "CatalystApiError",
      code: "INVALID_API_RESPONSE",
      correlationId: "correlation-html-response",
      status: 500,
    });
  });

  it.each([401, 403, 404, 409, 422, 500])(
    "preserves structured JSON errors for status %i",
    async (status) => {
      const response = Response.json(
        {
          code: `STATUS_${status}`,
          correlationId: `correlation-${status}`,
          message: `Structured error ${status}`,
        },
        { status },
      );

      try {
        await readApiJson(response, "Fallback");
        throw new Error("Expected readApiJson to reject.");
      } catch (error) {
        expect(error).toBeInstanceOf(CatalystApiError);
        expect(error).toMatchObject({
          code: `STATUS_${status}`,
          correlationId: `correlation-${status}`,
          status,
        });
        expect((error as Error).message).toContain(`Structured error ${status}`);
      }
    },
  );
});
