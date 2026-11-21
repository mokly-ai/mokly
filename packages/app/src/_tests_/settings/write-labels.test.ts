import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiError, unexpectedError } from "../../api/errors";
import { nonRetryable } from "../../api/form-error";
import { formFailure } from "../../components/form-failure";
import { failureAfterInput, wayBack, writeLabel } from "../../settings/write";

test("a control at rest reads its own resting label", () => {
  const resting = { pending: false, error: undefined };
  assert.equal(writeLabel(resting, "Save role", "Saving…"), "Save role");
  assert.equal(writeLabel(resting, "Remove", "Removing…"), "Remove");
});

test("a control names its own operation while it runs", () => {
  const working = { pending: true, error: undefined };
  assert.equal(writeLabel(working, "Save role", "Saving…"), "Saving…");
});

test("only the write that failed offers the way back", () => {
  const failed = { pending: false, error: unexpectedError() };
  const resting = { pending: false, error: undefined };
  // The failure belongs to one control's write, so the other control beside
  // it still reads its own label: a retry can never invoke the neighbour.
  assert.equal(writeLabel(failed, "Remove", "Removing…"), "Try again");
  assert.equal(writeLabel(resting, "Save role", "Saving…"), "Save role");
});

test("a refusal the reader must answer keeps the control's label", () => {
  const answered = { pending: false, error: unexpectedError(), answered: true };
  // The cause is on the field the reader can change; the same request cannot
  // succeed until they change it, so the control still names what it does.
  assert.equal(writeLabel(answered, "Save role", "Saving…"), "Save role");
  assert.equal(
    writeLabel({ ...answered, pending: true }, "Save role", "Saving…"),
    "Saving…",
  );
});

test("a non-retryable refusal keeps the control's label", () => {
  assert.deepEqual(
    [...nonRetryable],
    [
      "plan-required",
      "builds-unavailable",
      "build-ineligible",
      "subscription-active",
      "permission-denied",
      "duplicate-project",
      "last-owner",
      "already-member",
      "invitation-expired",
    ],
  );
  for (const reason of nonRetryable) {
    const error = new ApiError({
      code: "failed-precondition",
      reason,
      message: "The same request will be refused again.",
      requestId: "01994f10-0000-7000-8000-0000000000bb",
      status: 400,
    });
    const failure = formFailure({ pending: false, error }, {});
    assert.equal(
      failure.label("Make change", "Making change…"),
      "Make change",
      reason,
    );
  }
});

test("a screen may name the way back it offers", () => {
  const failed = { pending: false, error: unexpectedError() };
  assert.equal(writeLabel(failed, "Create workspace", "Creating…"), wayBack);
  assert.equal(
    writeLabel(failed, "Create workspace", "Creating…", "Start again"),
    "Start again",
  );
});

test("a failure is forgotten when its input is undone", () => {
  const failure = unexpectedError();
  // The reader put the role back the way it was: there is no longer an attempt
  // for the failure to describe, so the notice and its way back go too.
  assert.equal(failureAfterInput(failure, false), undefined);
});

test("a failure stays while the input still differs", () => {
  const failure = unexpectedError();
  assert.equal(failureAfterInput(failure, true), failure);
});
