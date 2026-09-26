import assert from "node:assert/strict";
import test from "node:test";

import { publishOutput } from "../dist/cli/publish_output.js";
import { PlainReporter } from "../dist/cli/reporter/plain.js";
import { RichReporter } from "../dist/cli/reporter/rich.js";

import { memoryTerminal } from "./helpers/terminal.js";

test("plain publish output uses counts or the already-published line", () => {
  for (const [result, expected] of [
    [
      {
        outcome: "published" as const,
        uploaded: 1,
        unchanged: 0,
        viewerUrl: "https://mokly.ai/catalogue",
      },
      "Published Mokly catalogue. 1 files uploaded, 0 unchanged.\nhttps://mokly.ai/catalogue\n",
    ],
    [
      {
        outcome: "already-published" as const,
        uploaded: 0,
        unchanged: 1,
        viewerUrl: null,
      },
      "Mokly catalogue already published for this commit.\n",
    ],
  ] as const) {
    const terminal = memoryTerminal({ isTTY: false });
    const reporter = new PlainReporter(terminal.environment);
    const output = publishOutput(result, "secret");
    reporter.summary(output.plain, output.rich, 900);
    if (output.viewerUrl) reporter.write(`${output.viewerUrl}\n`);
    assert.equal(terminal.stdout(), expected);
    assert.equal(terminal.stderr(), "");
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
        },
        token,
      ).viewerUrl,
      null,
    );
});
