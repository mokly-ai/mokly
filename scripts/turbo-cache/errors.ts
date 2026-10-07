export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "method_not_allowed"
  | "too_large"
  | "unsupported_media_type"
  | "internal_error"
  | "configuration_error";

export class CacheError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly diagnostic: string = message,
  ) {
    super(message);
  }
}

export function errorResponse(
  error: unknown,
  head: boolean,
  log: (message: string) => void = console.warn,
): Response {
  const failure =
    error instanceof CacheError
      ? error
      : new CacheError(500, "internal_error", "Cache storage failed.");
  if (failure.status >= 500)
    log(
      error instanceof CacheError
        ? `${error.name}: ${error.diagnostic}`
        : error instanceof Error
          ? `${error.name}: ${error.message}`
          : "UnknownError: Unexpected cache error.",
    );
  const detail = { code: failure.code, message: failure.message };
  return new Response(
    head ? null : JSON.stringify({ ...detail, error: detail }),
    {
      status: failure.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
      },
    },
  );
}
