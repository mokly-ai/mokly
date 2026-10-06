import assert from "node:assert/strict";
import test from "node:test";

import {
  publishOutput,
  publishProgressLabel,
  UNCOMMITTED_CHANGES_LINE,
} from "../dist/cli/publish_output.js";
import { PlainReporter } from "../dist/cli/reporter/plain.js";
import { RichReporter } from "../dist/cli/reporter/rich.js";

import { memoryTerminal } from "./helpers/terminal.js";

test("publish progress pluralizes 0, 1 and 2 total files", () => {
  assert.equal(
    publishProgressLabel({ completed: 0, total: 0, totalBytes: 0 }),
    "Uploading catalogue",
  );
  assert.equal(
    publishProgressLabel({ completed: 0, total: 1, totalBytes: 312 }),
    "Uploading 0 of 1 file · 312 B",
  );
  assert.equal(
    publishProgressLabel({ completed: 0, total: 2, totalBytes: 4_198 }),
    "Uploading 0 of 2 files · 4.1 KiB",
  );
});

test("plain publish output pluralizes 0, 1 and 2 files", () => {
  for (const [uploaded, noun] of [
    [0, "files"],
    [1, "file"],
    [2, "files"],
  ] as const) {
    const terminal = memoryTerminal({ isTTY: false });
    const reporter = new PlainReporter(terminal.environment);
    const output = publishOutput(
      {
        outcome: "published",
        uploaded,
        unchanged: 2 - uploaded,
        viewerUrl: "https://mokly.ai/catalogue",
        uncommittedChanges: false,
      },
      "secret",
    );
    reporter.summary(output.plain, output.rich, 900);
    if (output.viewerUrl) reporter.write(`${output.viewerUrl}\n`);
    assert.equal(
      terminal.stdout(),
      `Published Mokly catalogue. ${uploaded} ${noun} uploaded, ${2 - uploaded} unchanged.\nhttps://mokly.ai/catalogue\n`,
    );
    assert.equal(terminal.stderr(), "");
  }
});

test("plain publish output uses the already-published line", () => {
  const terminal = memoryTerminal({ isTTY: false });
  const reporter = new PlainReporter(terminal.environment);
  const output = publishOutput(
    {
      outcome: "already-published",
      uploaded: 0,
      unchanged: 1,
      viewerUrl: null,
      uncommittedChanges: false,
    },
    "secret",
  );
  reporter.summary(output.plain, output.rich, 900);
  assert.equal(
    terminal.stdout(),
    "Mokly catalogue already published for this commit.\n",
  );
  assert.equal(terminal.stderr(), "");
});

test("rich publish summaries pluralize 0, 1 and 2 files", () => {
  for (const [uploaded, noun] of [
    [0, "files"],
    [1, "file"],
    [2, "files"],
  ] as const) {
    const output = publishOutput(
      {
        outcome: "published",
        uploaded,
        unchanged: 2 - uploaded,
        viewerUrl: null,
        uncommittedChanges: false,
      },
      "secret",
    );
    assert.equal(
      output.rich,
      `Published Mokly catalogue · ${uploaded} ${noun} uploaded, ${2 - uploaded} unchanged`,
    );
  }
});

test("rich publish output keeps summaries styled and viewer URLs unstyled", () => {
  const terminal = memoryTerminal({ isTTY: true });
  const reporter = new RichReporter(terminal.environment);
  const output = publishOutput(
    {
      outcome: "published",
      uploaded: 12,
      unchanged: 266,
      viewerUrl: "https://mokly.ai/catalogue",
      uncommittedChanges: false,
    },
    "secret",
  );
  reporter.summary(output.plain, output.rich, 900);
  if (output.viewerUrl) reporter.write(`${output.viewerUrl}\n`);
  assert.equal(
    terminal.stdout(),
    "  ✔ Published Mokly catalogue · 12 files uploaded, 266 unchanged (900ms)\nhttps://mokly.ai/catalogue\n",
  );
  assert.equal(terminal.stderr(), "");

  const replayTerminal = memoryTerminal({ isTTY: true });
  const replayReporter = new RichReporter(replayTerminal.environment);
  const replay = publishOutput(
    {
      outcome: "already-published",
      uploaded: 0,
      unchanged: 278,
      viewerUrl: null,
      uncommittedChanges: false,
    },
    "secret",
  );
  replayReporter.summary(replay.plain, replay.rich, 2_100);
  assert.equal(
    replayTerminal.stdout(),
    "  ✔ Mokly catalogue already published for this commit (2.1s)\n",
  );
});

test("viewer URLs containing raw or encoded bearer tokens are omitted", () => {
  const token = "private/token+padding==";
  for (const viewerUrl of [
    `https://mokly.ai/catalogue?token=${token}`,
    `https://mokly.ai/catalogue?token=${encodeURIComponent(token)}`,
  ])
    assert.equal(
      publishOutput(
        {
          outcome: "published",
          uploaded: 1,
          unchanged: 2,
          viewerUrl,
          uncommittedChanges: false,
        },
        token,
      ).viewerUrl,
      null,
    );
});

test("a dirty publication adds one aligned line in plain and rich output", () => {
  const result = {
    outcome: "published" as const,
    uploaded: 2,
    unchanged: 5,
    viewerUrl: "https://mokly.ai/catalogue",
    uncommittedChanges: true,
  };
  const output = publishOutput(result, "secret");
  assert.equal(output.note, "This publication includes uncommitted changes.");
  assert.equal(output.note, UNCOMMITTED_CHANGES_LINE);
  assert.equal(
    publishOutput({ ...result, uncommittedChanges: false }, "secret").note,
    null,
  );
  const render = (tty: boolean) => {
    const terminal = memoryTerminal({ isTTY: tty });
    const reporter = tty
      ? new RichReporter(terminal.environment)
      : new PlainReporter(terminal.environment);
    reporter.summary(output.plain, output.rich, 900);
    if (output.note) reporter.write(`${output.note}\n`);
    if (output.viewerUrl) reporter.write(`${output.viewerUrl}\n`);
    assert.equal(terminal.stderr(), "");
    return terminal.stdout();
  };
  assert.equal(
    render(false),
    "Published Mokly catalogue. 2 files uploaded, 5 unchanged.\n" +
      "This publication includes uncommitted changes.\n" +
      "https://mokly.ai/catalogue\n",
  );
  assert.equal(
    render(true),
    "  ✔ Published Mokly catalogue · 2 files uploaded, 5 unchanged (900ms)\n" +
      "This publication includes uncommitted changes.\n" +
      "https://mokly.ai/catalogue\n",
  );
});
