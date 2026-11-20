import type { Publication } from "../api/types";

/** The persisted classification of one failed upload attempt. */
export type FailureCode = NonNullable<Publication["failureCode"]>;

/**
 * What a reader can do about a publication that did not arrive. Every line is
 * the reviewer's half of the message: the outcome and the one action available
 * to them. The developer's half — paths, versions, validation names — belongs
 * in the check run and the CLI, never here.
 */
const recovery: Record<FailureCode, string> = {
  "invalid-bundle": "Ask a project admin to publish again.",
  "unsupported-version": "Update Mokly in the project, then publish again.",
  "too-large":
    "This catalogue is over the publishing limit. Ask a project admin to publish again.",
  unauthorized:
    "The publishing token was not accepted. A project admin can create a new one.",
  internal: "Ask a project admin to publish again.",
  expired: "This publication is no longer kept.",
  superseded: "A newer publication replaced this one.",
};

/** The one sentence a failed publication carries beside its heading. */
export function failureRecovery(code: FailureCode | null): string {
  return code ? recovery[code] : "Ask a project admin to publish again.";
}

/** What a failed publication is called, naming its branch when it has one. */
export function failureTitle(branch: string | null): string {
  return branch ? "Unable to publish this branch" : "Unable to publish";
}
