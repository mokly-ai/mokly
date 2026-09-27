import assert from "node:assert/strict";
import test from "node:test";

import { publishFailure } from "../dist/cli/publish_failure.js";
import { MoklyError } from "../dist/errors.js";
import { PublishCancelledError } from "../dist/publish/errors.js";

test("publish failure maps only real cancellations", () => {
  const marked = new MoklyError("export-invalid", "cancelled", {
    cancelled: true,
  });
  const abort = new Error("aborted", { cause: new Error("private cause") });
  abort.name = "AbortError";

  for (const cancellation of [marked, abort]) {
    const mapped = publishFailure(cancellation);
    assert.ok(mapped instanceof PublishCancelledError);
    assert.equal(mapped.code, "upload-failed");
    assert.equal(mapped.cancelled, true);
    assert.equal(mapped.cause, undefined);
    assert.equal(
      mapped.message,
      "[mokly/upload-failed] Publication was cancelled. Run mokly publish again when you are ready.",
    );
  }
});

test("publish failure preserves every non-cancellation Mokly error", () => {
  const cancellation = new MoklyError("export-invalid", "cancelled", {
    cancelled: true,
  });
  const recovery = new MoklyError(
    "export-invalid",
    "Export rollback failed; recover from /repo/backup.",
    { cause: cancellation },
  );
  const ordinary = new MoklyError("git-failed", "Git failed");

  assert.equal(publishFailure(recovery), recovery);
  assert.equal(publishFailure(ordinary), ordinary);
});

test("publish failure safely maps an unexpected preparation failure", () => {
  const mapped = publishFailure(new Error("private failure"));
  assert.equal(mapped.code, "upload-failed");
  assert.equal(mapped.cancelled, false);
  assert.equal(mapped.cause, undefined);
  assert.equal(
    mapped.message,
    "[mokly/upload-failed] Could not prepare the publication. Check local configuration and temporary storage before retrying.",
  );
});
