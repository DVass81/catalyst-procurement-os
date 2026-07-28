export interface AiHttpFailure {
  status: 401 | 403 | 500 | 503;
  code:
    | "authentication_required"
    | "tenant_access_denied"
    | "usage_ledger_unavailable"
    | "cate_unavailable";
  message: string;
  retryAfterSeconds?: number;
}

export function describeAiHttpFailure(error: unknown): AiHttpFailure {
  const message = error instanceof Error ? error.message : "";

  if (message === "AUTHENTICATION_REQUIRED") {
    return {
      status: 401,
      code: "authentication_required",
      message: "Authentication is required.",
    };
  }

  if (message === "TENANT_ACCESS_DENIED") {
    return {
      status: 403,
      code: "tenant_access_denied",
      message: "This tenant is not assigned to your account.",
    };
  }

  if (message.startsWith("AI_USAGE_RECORD_FAILED:")) {
    return {
      status: 503,
      code: "usage_ledger_unavailable",
      message:
        "CATE's audit ledger is temporarily unavailable. No action was taken. Please try again.",
      retryAfterSeconds: 5,
    };
  }

  return {
    status: 500,
    code: "cate_unavailable",
    message:
      "CATE is temporarily unavailable. No action was taken. Please try again.",
  };
}
