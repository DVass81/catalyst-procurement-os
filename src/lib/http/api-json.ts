export interface ApiErrorPayload {
  code?: string;
  correlationId?: string;
  message?: string;
  [key: string]: unknown;
}

const statusMessages: Record<number, string> = {
  401: "Your session is no longer valid. Sign in again before continuing.",
  403: "Your current role is not authorized for this action.",
  404: "The requested Catalyst service endpoint is unavailable.",
  409: "The record changed before this action completed. Refresh and try again.",
  422: "The submitted information could not be validated.",
  500: "Catalyst could not complete the request.",
};

function defaultStatusMessage(status: number, fallbackMessage: string) {
  const exactMessage = statusMessages[status];
  if (exactMessage) return exactMessage;
  if (status >= 500) return "Catalyst could not complete the request.";
  return fallbackMessage;
}

function correlationSuffix(correlationId?: string) {
  return correlationId ? ` Reference: ${correlationId}.` : "";
}

export class CatalystApiError extends Error {
  readonly code?: string;
  readonly correlationId?: string;
  readonly payload?: ApiErrorPayload;
  readonly status: number;

  constructor(input: {
    code?: string;
    correlationId?: string;
    message: string;
    payload?: ApiErrorPayload;
    status: number;
  }) {
    super(`${input.message}${correlationSuffix(input.correlationId)}`);
    this.name = "CatalystApiError";
    this.code = input.code;
    this.correlationId = input.correlationId;
    this.payload = input.payload;
    this.status = input.status;
  }
}

export async function readApiJson<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const headerCorrelationId =
    response.headers.get("x-catalyst-correlation-id") ?? undefined;
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.includes("application/json")) {
    throw new CatalystApiError({
      code: "INVALID_API_RESPONSE",
      correlationId: headerCorrelationId,
      message:
        response.status >= 500
          ? "Catalyst is temporarily unavailable; no action was applied."
          : "Catalyst received an invalid server response; no action was applied.",
      status: response.status,
    });
  }

  let payload: ApiErrorPayload;
  try {
    payload = (await response.json()) as ApiErrorPayload;
  } catch {
    throw new CatalystApiError({
      code: "MALFORMED_API_RESPONSE",
      correlationId: headerCorrelationId,
      message: "Catalyst received malformed response data; no action was applied.",
      status: response.status,
    });
  }

  if (!response.ok) {
    const correlationId = payload.correlationId ?? headerCorrelationId;
    const payloadMessage =
      typeof payload.message === "string" ? payload.message.trim() : "";
    throw new CatalystApiError({
      code: payload.code,
      correlationId,
      message:
        payloadMessage || defaultStatusMessage(response.status, fallbackMessage),
      payload,
      status: response.status,
    });
  }

  return payload as T;
}
