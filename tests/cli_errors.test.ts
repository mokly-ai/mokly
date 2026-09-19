import assert from "node:assert/strict";
import test from "node:test";

import { cliErrorPresentation } from "../dist/cli/errors.js";
import { MoklyError, type MoklyErrorCode } from "../dist/errors.js";

const EXPECTED = new Map<MoklyErrorCode, RegExp>([
  ["baseline-history-unavailable", /history is unavailable/i],
  ["baseline-extraction-failed", /baseline could not be prepared/i],
  ["baseline-command-failed", /baseline build failed/i],
  ["baseline-output-invalid", /baseline output is invalid/i],
  ["baseline-interrupted", /preparation was interrupted/i],
  ["baseline-lock-timeout", /baseline is busy/i],
  ["build-invalid", /catalogue could not be built/i],
  ["cli-invalid", /command could not be understood/i],
  ["config-invalid", /configuration is invalid/i],
  ["config-missing", /configuration was found/i],
  ["export-invalid", /could not be exported/i],
  ["git-failed", /Git information could not be read/i],
  ["manifest-invalid", /generated catalogue is invalid/i],
  ["review-invalid", /comparison could not be created/i],
  ["server-failed", /server could not start/i],
  ["upload-failed", /could not be published/i],
  ["upload-invalid-bundle", /upload is invalid/i],
  ["upload-too-large", /too large to publish/i],
  ["upload-unauthorized", /not authorized/i],
  ["upload-unsupported-version", /does not support/i],
]);

test("every typed error code has a human headline and actionable hint", () => {
  for (const [code, headline] of EXPECTED) {
    const presentation = cliErrorPresentation(
      new MoklyError(code, "synthetic detail"),
    );
    assert.equal(presentation.code, code);
    assert.match(presentation.headline, headline, code);
    assert.ok(presentation.hint.length > 10, code);
    assert.equal(presentation.detail, "synthetic detail");
  }
});

test("unknown commands and options get specific copy and a closest command", () => {
  assert.deepEqual(
    cliErrorPresentation(
      new MoklyError("cli-invalid", "unknown command: buld"),
    ),
    {
      code: "cli-invalid",
      detail: undefined,
      headline: 'Unknown command "buld".',
      hint: 'Did you mean "build"? Run mokly --help to see commands.',
    },
  );
  assert.equal(
    cliErrorPresentation(
      new MoklyError("cli-invalid", "unknown option: --watc"),
    ).headline,
    'Unknown option "--watc".',
  );
});
