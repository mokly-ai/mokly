import assert from "node:assert/strict";
import test from "node:test";

import { PlainReporter } from "../dist/cli/reporter/plain.js";
import { RichReporter } from "../dist/cli/reporter/rich.js";
import { isMoklyError } from "../dist/errors.js";
import { checkoutFailure } from "../dist/publish/checkout_errors.js";

import { memoryTerminal } from "./helpers/terminal.js";

for (const [code, headline, hint] of [
  [
    "git-uncommitted",
    "The checkout has uncommitted changes.",
    "Commit, stash or ignore these files, then publish again.",
  ],
  [
    "build-stale",
    "The committed generated files are out of date.",
    "Run mokly build, commit the result and publish again.",
  ],
] as const) {
  for (const mode of ["plain", "rich"] as const) {
    for (const total of [21, 25]) {
      test(`${code} ${mode} output bounds ${total} paths and keeps headline, detail and hint once`, () => {
        const paths = Array.from(
          { length: total },
          (_, index) => `file-${String(index).padStart(2, "0")}.md`,
        );
        paths[0] = `file-00\n${String.fromCharCode(27)}.md`;
        const error = checkoutFailure(code, [...paths, paths[0]!], true);
        assert.equal(isMoklyError(error), true);
        const terminal = memoryTerminal({
          isTTY: mode === "rich",
          columns: 240,
        });
        const reporter =
          mode === "rich"
            ? new RichReporter(terminal.environment)
            : new PlainReporter(terminal.environment);
        reporter.renderError(error, (value) => value);
        reporter.close();
        const output = terminal.stderr();
        assert.ok(output.includes(`[mokly/${code}]`));
        assert.equal(output.split(headline).length - 1, 1);
        assert.equal(output.split(hint).length - 1, 1);
        assert.ok(output.includes("Changes appeared during the export."));
        assert.equal(
          output.split("\n").filter((line) => /^\s+- /.test(line)).length,
          20,
        );
        assert.ok(
          output.includes(total === 21 ? "1 other path." : "5 other paths."),
        );
        assert.ok(output.includes("file-00\\u000a\\u001b.md"));
        assert.equal(output.includes("file-20.md"), false);
        assert.equal(output.includes(String.fromCharCode(27)), false);
      });
    }
  }
}
