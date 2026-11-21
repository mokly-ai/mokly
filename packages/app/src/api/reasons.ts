import type { components } from "./generated/schema";

/** One reason from the Rust-generated error envelope. */
export type ApiReason = components["schemas"]["Error"]["error"]["reason"];

/**
 * The API's stable error reasons, catalogued in `docs/protocol/cloud/rest-api.md` and
 * inventoried in `docs/api/openapi.json`. The UI branches on these
 * values, never on message text or HTTP status alone.
 */
const values = [
  "validation-failed",
  "unauthenticated",
  "permission-denied",
  "not-found",
  "version-conflict",
  "head-changed",
  "rate-limited",
  "unavailable",
  "duplicate-project",
  "slug-taken",
  "slug-reserved",
  "last-owner",
  "csrf-rejected",
  "magic-link-invalid",
  "magic-link-expired",
  "magic-link-used",
  "desktop-grant-invalid",
  "session-expired",
  "token-revoked",
  "invitation-expired",
  "already-member",
  "operation-unavailable",
  "method-not-allowed",
  "payload-too-large",
  "internal-error",
  "invalid-anchor",
  "review-closed",
  "migrations-pending",
  "github-auth-invalid",
  "github-email-unverified",
  "github-identity-conflict",
  "github-installation-conflict",
  "webhook-signature-invalid",
  "plan-required",
  "builds-unavailable",
  "build-ineligible",
  "build-already-active",
  "build-already-published",
  "subscription-active",
  "upload-unsupported-version",
  "upload-invalid-bundle",
  "upload-unauthorized",
  "upload-forbidden",
  "upload-plan-required",
  "upload-too-large",
  "upload-unavailable",
  "upload-timeout",
  "upload-blob-mismatch",
  "upload-unknown-blob",
  "upload-incomplete",
  "upload-expired",
  "upload-failed",
] as const satisfies readonly ApiReason[];

/** All generated values, checked for missing and extra entries at compile time. */
export const apiReasons: [ApiReason] extends [(typeof values)[number]]
  ? typeof values
  : never = values;

const known: ReadonlySet<string> = new Set(apiReasons);

/** Whether a server-supplied string is a reason this build knows about. */
export function isApiReason(value: string): value is ApiReason {
  return known.has(value);
}

/** The reasons that mean the reader is no longer signed in. */
export const signedOutReasons: readonly ApiReason[] = [
  "unauthenticated",
  "session-expired",
];
