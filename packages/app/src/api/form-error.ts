import type { ApiError } from "./errors";
import { publishesFromCi } from "./labels";
import type { ApiReason } from "./reasons";
import type { IneligibleCause } from "./types";

/** What a form shows after a failed submission, and where it shows it. */
export interface FormFailure {
  /** The field the failure belongs to, when one owns it. */
  field?: string;
  /** The sentence the reader sees. */
  message: string;
}

/**
 * The copy each catalogued reason carries in a form. It names what failed and
 * what the reader can do, so no form invents its own generic sentence, and no
 * failure lands on a field that had nothing to do with it.
 */
const copy: Partial<Record<ApiReason, string>> = {
  "validation-failed": "Check the values and try again.",
  unauthenticated: "Sign in again to continue.",
  "session-expired": "Sign in again to continue.",
  "permission-denied": "You don’t have permission to do that.",
  "csrf-rejected": "Reload the page and try again.",
  "not-found": "That is no longer available.",
  "version-conflict": "This changed elsewhere. Reopen it to see the latest.",
  "last-owner": "A workspace keeps at least one owner.",
  "already-member": "That address already has access.",
  "duplicate-project": "This repository already has a project.",
  "plan-required": "Private projects are on Team.",
  "builds-unavailable": publishesFromCi,
  "subscription-active": "Your subscription is still being confirmed.",
  "invitation-expired": "That invitation has expired. Send another.",
  "operation-unavailable": "This opens soon.",
  unavailable: "Mokly is busy. Try again in a moment.",
  "payload-too-large": "That is too large to send.",
  "internal-error": "Something went wrong. Try again.",
  "migrations-pending": "Mokly is updating. Try again in a moment.",
  // A form meets this reason only as a refused preview password; a link's
  // own landing titles the refusal itself.
  "magic-link-invalid": "This password isn’t valid.",
  "github-auth-invalid": "Start GitHub sign-in again.",
  "github-email-unverified":
    "Verify your primary email on GitHub, or sign in by email.",
  "github-identity-conflict": "Use the GitHub account linked to your email.",
  "github-installation-conflict":
    "This GitHub account is connected to another workspace.",
};

/**
 * What `build-ineligible` says, chosen by why the pull request cannot build. A
 * closed pull request gets no new build, and no build runs for a fork's pull
 * request: its sentence is the fork card's title. Keyed by every cause, so a
 * new one without a sentence fails to compile rather than borrowing another
 * cause's words.
 */
export const ineligibleCopy = {
  "closed-pull-request": "This pull request is closed.",
  "fork-pull-request": "This pull request is from a fork.",
} as const satisfies Record<IneligibleCause, string>;

/** Failures the same unchanged request cannot make succeed. */
export const nonRetryable: ReadonlySet<ApiReason> = new Set([
  "plan-required",
  "builds-unavailable",
  "build-ineligible",
  "subscription-active",
  "permission-denied",
  "duplicate-project",
  "last-owner",
  "already-member",
  "invitation-expired",
]);

function retryCopy(error: ApiError): string {
  return error.retryAfterSeconds
    ? `Try again in ${error.retryAfterSeconds} seconds.`
    : "Try again shortly.";
}

/**
 * Which field owns a reason on this form, and what that field says there.
 *
 * Naming the field is the whole declaration for a reason whose shared sentence
 * this form is content to draw. A form whose own field draws a different
 * sentence declares it here, beside the ownership it already declares, so the
 * sentence belongs to the one form that draws it: an address the API refused
 * asks for a complete email address, which is what the registered input's
 * invalid variant draws, while every other form keeps "Check the values and
 * try again." for the same reason.
 *
 * A sentence can only be declared where the field is, because a cause reported
 * beside the action is the shared vocabulary every control speaks.
 */
export type FieldOwner = string | { field: string; says: string };

/** The field a reason belongs to on one form, and the sentence it draws. */
function owned(owner: FieldOwner | undefined): {
  field: string | undefined;
  says: string | undefined;
} {
  if (owner === undefined) return { field: undefined, says: undefined };
  if (typeof owner === "string") return { field: owner, says: undefined };
  return { field: owner.field, says: owner.says };
}

/**
 * Turn one typed failure into the form's own message and the field that owns
 * it. `fields` names the field a reason belongs to on this particular form,
 * and is required so no form can claim ownership it never declared; a reason
 * with no owner here is reported beside the action instead. A field that
 * declares its own sentence draws that one rather than the shared copy. An
 * unrecognised reason falls back to the API's own client-safe message, which
 * is always more specific than a sentence this application could invent; so
 * does a pull request refused for a cause this build does not know.
 */
export function formError(
  error: ApiError,
  fields: Partial<Record<ApiReason, FieldOwner>>,
): FormFailure {
  const { field, says } = owned(
    error.reason === "unrecognized" ? undefined : fields[error.reason],
  );
  if (says !== undefined) return { field, message: says };
  const taken = error.dataFor("slug-taken")?.suggestedSlug;
  if (taken !== undefined) {
    return {
      field,
      message: `This address is already in use. Try ${taken}.`,
    };
  }
  const reserved = error.dataFor("slug-reserved")?.suggestedSlug;
  if (reserved !== undefined) {
    return {
      field,
      message: `This address isn’t available. Try ${reserved}.`,
    };
  }
  if (error.reason === "rate-limited") {
    return { field, message: retryCopy(error) };
  }
  if (error.reason === "build-ineligible") {
    const cause = error.dataFor("build-ineligible")?.cause;
    return {
      field,
      message: cause === undefined ? error.message : ineligibleCopy[cause],
    };
  }
  const known =
    error.reason === "unrecognized" ? undefined : copy[error.reason];
  return { field, message: known ?? error.message };
}
