import assert from "node:assert/strict";
import { test } from "node:test";

import { MoklyVersionError } from "../src/catalogue/version_error.js";
import {
  EntryUnavailableError,
  viewerFailures,
} from "../src/viewer/failures.js";
import type { ViewerError } from "../src/viewer/types.js";

function reporter() {
  const errors: ViewerError[] = [];
  const report = viewerFailures(
    () => ({ onError: (error) => errors.push(error) }),
    () => true,
  );
  return { errors, report };
}

test("each failed detail load reports one catalogue error", () => {
  const { errors, report } = reporter();
  const first = new EntryUnavailableError();
  report(first, "catalogue");
  report(first, "catalogue");
  report(new EntryUnavailableError(), "catalogue");
  assert.deepEqual(errors, [
    {
      code: "catalogue",
      message: "This entry could not be loaded. Try again.",
    },
    {
      code: "catalogue",
      message: "This entry could not be loaded. Try again.",
    },
  ]);
});

test("another deployment reports once, and a newer format as a version error", () => {
  const { errors, report } = reporter();
  const replaced = new Error("another deployment answered");
  report(replaced, "catalogue");
  report(replaced, "catalogue");
  report(new MoklyVersionError("detail", 2, 1), "catalogue");
  assert.equal(errors.length, 2);
  assert.deepEqual(errors[0], {
    code: "catalogue",
    message: "The catalogue changed. Reload it to see the new version.",
  });
  assert.deepEqual(errors[1], {
    code: "version",
    message: "This catalogue needs a compatible viewer",
    details:
      "Unsupported Mokly detail version 2; this viewer supports version 1.",
  });
});
