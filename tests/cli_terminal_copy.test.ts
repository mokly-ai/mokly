import assert from "node:assert/strict";
import test from "node:test";

import { RichReporter } from "../packages/mokly/dist/cli/reporter/rich.js";
import { formatCount } from "../packages/mokly/dist/cli/reporter/terminal.js";
import {
  publishCancelled,
  uploadTransportFailed,
} from "../packages/mokly/dist/publish/errors.js";

import { emulateTerminal, memoryTerminal } from "./helpers/terminal.js";

const ESCAPE = String.fromCharCode(27);

test("every TTY progress frame erases long labels and re-plan resets", async () => {
  const terminal = memoryTerminal({ columns: 80, isTTY: true });
  const reporter = new RichReporter(terminal.environment);
  const phase = reporter.startPhase(
    "Uploading a catalogue with an intentionally long progress label",
  );
  phase.update("Short label");
  await new Promise((resolve) => setTimeout(resolve, 90));
  let rendered = emulateTerminal(terminal.stdout());
  assert.equal(rendered.currentLine, "  ⠙ Short label…");

  phase.update("Uploading 12 of 12 files · 106.2 KiB");
  phase.update("Uploading catalogue");
  rendered = emulateTerminal(terminal.stdout());
  assert.equal(rendered.currentLine, "  ⠙ Uploading catalogue…");
  for (const frame of terminal.stdout().split("\r").slice(1))
    assert.ok(frame.startsWith(`${ESCAPE}[2K`), JSON.stringify(frame));
  reporter.close();
});

test("terminal count copy uses singular only for one", () => {
  assert.equal(formatCount(0, "file"), "0 files");
  assert.equal(formatCount(1, "file"), "1 file");
  assert.equal(formatCount(2, "file"), "2 files");
});

test("Serve changes use singular only for one screen", () => {
  for (const [changed, noun] of [
    [0, "screens"],
    [1, "screen"],
    [2, "screens"],
  ] as const) {
    const terminal = memoryTerminal({ isTTY: true });
    const reporter = new RichReporter(terminal.environment);
    reporter.changesReady(changed, 100);
    assert.equal(
      terminal.stdout(),
      `  ✔ Changes ready · ${changed} changed ${noun} (100ms)\n`,
    );
  }
});

test("typed publish failures have distinct rich copy without repetition", () => {
  for (const [error, headline, hint] of [
    [
      publishCancelled(),
      "Publication was cancelled.",
      "Run mokly publish again when you are ready.",
    ],
    [
      uploadTransportFailed(),
      "The catalogue upload did not complete.",
      "Check the endpoint and connection, then retry.",
    ],
  ] as const) {
    const terminal = memoryTerminal({ isTTY: true });
    const reporter = new RichReporter(terminal.environment);
    reporter.renderError(error, (value) => value);
    assert.equal(
      terminal.stderr(),
      `  ✖ ${headline}  [mokly/upload-failed]\n    ${hint}\n`,
    );
    assert.equal(terminal.stderr().split(headline).length - 1, 1);
    assert.equal(terminal.stderr().split(hint).length - 1, 1);
  }
});
