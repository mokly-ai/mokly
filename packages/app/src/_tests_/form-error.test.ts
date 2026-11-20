import assert from "node:assert/strict";
import { test } from "node:test";

import { ineligibleCauses } from "../api/error-data";
import { ApiError } from "../api/errors";
import { formError, ineligibleCopy } from "../api/form-error";
import { apiReasons } from "../api/reasons";

function failure(
  reason: string,
  extra: { retryAfterSeconds?: number; data?: unknown } = {},
): ApiError {
  return new ApiError({
    code: "bad-request",
    reason,
    message: "The API's own sentence.",
    requestId: "r-1",
    status: 400,
    retryAfterSeconds: extra.retryAfterSeconds,
    data: extra.data,
  });
}

test("a catalogued reason names what failed in the product's own words", () => {
  assert.equal(
    formError(failure("last-owner"), {}).message,
    "A workspace keeps at least one owner.",
  );
  assert.equal(
    formError(failure("version-conflict"), {}).message,
    "This changed elsewhere. Reopen it to see the latest.",
  );
  assert.equal(
    formError(failure("operation-unavailable"), {}).message,
    "This opens soon.",
  );
});

test("a rate limit reports the server's own delay", () => {
  assert.equal(
    formError(failure("rate-limited", { retryAfterSeconds: 42 }), {}).message,
    "Try again in 42 seconds.",
  );
  assert.equal(
    formError(failure("rate-limited"), {}).message,
    "Try again shortly.",
  );
});

test("a reason this build does not know falls back to the API's message", () => {
  assert.equal(
    formError(failure("something-new"), {}).message,
    "The API's own sentence.",
  );
  assert.equal(formError(failure("something-new"), {}).field, undefined);
});

test("a failure only lands on a field this form says owns it", () => {
  assert.equal(
    formError(failure("already-member"), { "already-member": "email" }).field,
    "email",
  );
  assert.equal(formError(failure("already-member"), {}).field, undefined);
  assert.equal(
    formError(failure("internal-error"), { "already-member": "email" }).field,
    undefined,
  );
});

test("slug refusals show the API's safe replacement on the slug field", () => {
  const fields = { "slug-taken": "slug", "slug-reserved": "slug" } as const;
  const data = { field: "slug", suggestedSlug: "mokly-team-2" };
  assert.deepEqual(formError(failure("slug-taken", { data }), fields), {
    field: "slug",
    message: "This address is already in use. Try mokly-team-2.",
  });
  assert.deepEqual(formError(failure("slug-reserved", { data }), fields), {
    field: "slug",
    message: "This address isn’t available. Try mokly-team-2.",
  });
});

test("a slug refusal without a usable suggestion reads the API's own sentence", () => {
  const fields = { "slug-taken": "slug", "slug-reserved": "slug" } as const;
  for (const data of [
    undefined,
    { field: "slug", suggestedSlug: "" },
    { field: "name", suggestedSlug: "mokly-team-2" },
  ]) {
    assert.deepEqual(formError(failure("slug-taken", { data }), fields), {
      field: "slug",
      message: "The API's own sentence.",
    });
  }
});

test("a malformed slug stays a form error when the API identifies no field", () => {
  const refused = formError(failure("validation-failed"), {
    "slug-taken": "slug",
    "slug-reserved": "slug",
  });
  assert.equal(refused.field, undefined);
  assert.equal(refused.message, "Check the values and try again.");
});

/**
 * What sign in and sign up declare: the address the API refused is the one
 * cause their own field owns, and the sentence it draws there is the
 * registered input's invalid variant rather than the shared copy.
 */
const entryFields = {
  "validation-failed": {
    field: "email",
    says: "Enter a complete email address.",
  },
};

test("a field draws the sentence its own form declares beside the ownership", () => {
  const refused = formError(failure("validation-failed"), entryFields);
  assert.equal(refused.field, "email");
  assert.equal(refused.message, "Enter a complete email address.");
});

test("a reason the form declares no owner for stays beside the control", () => {
  // A rate limit is not the reader's own text, so the entry form claims
  // nothing for it: the field is left unmarked and the server's own delay is
  // what the control is told.
  const limited = formError(
    failure("rate-limited", { retryAfterSeconds: 30 }),
    entryFields,
  );
  assert.equal(limited.field, undefined);
  assert.equal(limited.message, "Try again in 30 seconds.");
});

test("one form's own sentence leaves every other form the shared one", () => {
  // The settings panes and create-workspace declare ownership and nothing
  // else, so the shared copy is still what their field draws.
  assert.equal(
    formError(failure("validation-failed"), { "validation-failed": "name" })
      .message,
    "Check the values and try again.",
  );
  assert.equal(
    formError(failure("validation-failed"), {}).message,
    "Check the values and try again.",
  );
});

test("every catalogued reason produces a non-empty sentence", () => {
  for (const reason of apiReasons) {
    const message = formError(failure(reason), {}).message;
    assert.ok(message.length > 0, reason);
  }
});

test("a pull request that cannot build says why, by its cause", () => {
  const refused = (cause?: string) =>
    formError(failure("build-ineligible", { data: cause ? { cause } : {} }), {})
      .message;
  assert.equal(refused("closed-pull-request"), "This pull request is closed.");
  // No build runs for a fork: its sentence is the fork card's title.
  assert.equal(
    refused("fork-pull-request"),
    "This pull request is from a fork.",
  );
  assert.deepEqual(
    Object.keys(ineligibleCopy).sort(),
    [...ineligibleCauses].sort(),
  );
  // A cause this build does not know reads the API's own sentence.
  assert.equal(refused("draft-pull-request"), "The API's own sentence.");
  assert.equal(refused(), "The API's own sentence.");
});
