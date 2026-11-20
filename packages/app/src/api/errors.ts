import { parseErrorData } from "./error-data";
import type { ApiDataReason, ApiErrorData } from "./error-data";
import type { components } from "./generated/schema";
import { isApiReason, signedOutReasons } from "./reasons";
import type { ApiReason } from "./reasons";

/** One standard code from the Rust-generated error envelope. */
export type ApiCode = components["schemas"]["Error"]["error"]["code"];

/** The standard `rpc-error` codes the envelope carries. */
const values = [
  "bad-request",
  "invalid-argument",
  "failed-precondition",
  "out-of-range",
  "unauthenticated",
  "permission-denied",
  "not-found",
  "aborted",
  "already-exists",
  "resource-exhausted",
  "cancelled",
  "payload-too-large",
  "unavailable",
  "internal",
  "deadline-exceeded",
] as const satisfies readonly ApiCode[];

/** All generated values, checked for missing and extra entries at compile time. */
export const apiCodes: [ApiCode] extends [(typeof values)[number]]
  ? typeof values
  : never = values;

/** Whether a string is a code this build knows, rather than one it assumes. */
export function isApiCode(value: string): value is ApiCode {
  return (apiCodes as readonly string[]).includes(value);
}

/** A code this build does not know is not assumed to mean anything. */
function code(value: string): ApiCode {
  return isApiCode(value) ? value : "internal";
}

/**
 * One failed request. The UI branches on `reason`; `requestId` is shown in the
 * details of every error state so a report can be correlated with the server.
 */
export class ApiError extends Error {
  readonly code: ApiCode;
  readonly reason: ApiReason | "unrecognized";
  readonly rawReason: string;
  readonly requestId: string;
  readonly status: number;
  readonly retryAfterSeconds: number | undefined;
  /** The envelope's `data`, parsed for the reason it arrived with. */
  private readonly parsed: Partial<ApiErrorData>;

  constructor(input: {
    code: ApiCode;
    reason: string;
    message: string;
    requestId: string;
    status: number;
    retryAfterSeconds?: number;
    /** The envelope's `data` as it arrived; only its parsed form is kept. */
    data?: unknown;
  }) {
    super(input.message);
    this.name = "ApiError";
    this.code = input.code;
    this.rawReason = input.reason;
    this.reason = isApiReason(input.reason) ? input.reason : "unrecognized";
    this.requestId = input.requestId;
    this.status = input.status;
    this.retryAfterSeconds = input.retryAfterSeconds;
    this.parsed = parseErrorData(input.reason, input.data);
  }

  /**
   * The typed `data` of `reason`. It is present only when this failure is that
   * reason and its data has the type the generated contract gives it.
   */
  dataFor<Reason extends ApiDataReason>(
    reason: Reason,
  ): ApiErrorData[Reason] | undefined {
    return this.parsed[reason];
  }

  /** Whether this failure means the reader has to sign in again. */
  get signedOut(): boolean {
    return (
      this.reason !== "unrecognized" &&
      signedOutReasons.includes(this.reason as ApiReason)
    );
  }
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function envelope(body: unknown): Record<string, unknown> | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const error = (body as { error?: unknown }).error;
  return typeof error === "object" && error !== null
    ? (error as Record<string, unknown>)
    : undefined;
}

function retryAfter(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number.parseInt(header, 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

/**
 * Decode the `rpc-error` envelope. A response that is not the envelope — a
 * proxy page, a truncated body — still produces a typed internal error with the
 * correlation header, so no screen has to handle an untyped failure.
 */
export function decodeApiError(
  body: unknown,
  response: Response,
  requestId: string,
): ApiError {
  const error = envelope(body);
  return new ApiError({
    code: code(text(error?.code, "internal")),
    reason: text(error?.reason, "internal-error"),
    message: text(error?.message, "Something went wrong."),
    requestId: text(
      error?.request_id,
      text(response.headers.get("x-request-id"), requestId),
    ),
    status: response.status,
    retryAfterSeconds: retryAfter(response),
    data: error?.data,
  });
}

/** A request that never reached the API still needs a typed, shown failure. */
export function transportError(requestId: string): ApiError {
  return new ApiError({
    code: "unavailable",
    reason: "unavailable",
    message: "Can’t reach Mokly. Check your connection and try again.",
    requestId,
    status: 0,
  });
}

/**
 * A failure this application raised rather than the API. It carries no
 * correlation identifier, because none was ever sent, so no error state offers
 * a reference that appears in no log.
 */
export function unexpectedError(): ApiError {
  return new ApiError({
    code: "internal",
    reason: "internal-error",
    message: "Something went wrong.",
    requestId: "",
    status: 0,
  });
}

/** Narrow an unknown thrown value to the typed API failure. */
export function asApiError(error: unknown): ApiError | undefined {
  return error instanceof ApiError ? error : undefined;
}
