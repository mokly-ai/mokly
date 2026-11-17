import assert from "node:assert/strict";
import test from "node:test";

import { safeDiagnostic } from "../diagnostics.js";

import { navigationError } from "./navigation-error.js";

const credential = "e".repeat(64);

test("diagnostics never include navigation credentials or arbitrary error fields", () => {
  for (const error of [
    navigationError(
      `mokly-app://desktop/auth/email/callback#token=${credential}`,
    ),
    credential,
    { code: credential },
    { code: "https://example.com/?code=" + credential },
  ]) {
    assert.equal(
      safeDiagnostic(error).includes(credential),
      false,
      "a credential stays out of the warning",
    );
  }
  assert.equal(
    safeDiagnostic(
      navigationError(
        `mokly-app://desktop/auth/email/callback#token=${credential}`,
      ),
    ),
    "Desktop operation failed (ERR_ABORTED)",
  );
  assert.equal(
    safeDiagnostic(new Error("private details")),
    "Desktop operation failed",
  );
});
