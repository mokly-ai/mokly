import assert from "node:assert/strict";
import test from "node:test";

import { PlainReporter } from "../dist/cli/reporter/plain.js";
import { RichReporter } from "../dist/cli/reporter/rich.js";

import { memoryTerminal } from "./helpers/terminal.js";

test("plain reporter writes sorted build warning lines only to stderr", () => {
  const terminal = memoryTerminal({ isTTY: false });
  const reporter = new PlainReporter(terminal.environment);
  reporter.buildWarnings([
    {
      code: "link-control-ancestor",
      route: "screens/home.desktop.html",
      message: "MockLink child control is inside <button>",
    },
    {
      code: "link-control-descendant",
      route: "screens/home.mobile.html",
      message: 'MockLink child control contains <span tabindex="0">',
    },
  ]);
  assert.equal(terminal.stdout(), "");
  assert.equal(
    terminal.stderr(),
    "[mokly/warning] screens/home.desktop.html: MockLink child control is inside <button>\n" +
      '[mokly/warning] screens/home.mobile.html: MockLink child control contains <span tabindex="0">\n',
  );
});

test("warning reporters escape terminal control characters", () => {
  const diagnostic = {
    code: "link-control-ancestor" as const,
    route: "screens/home\u001b[2J.desktop.html",
    message: "warning\u009b2J",
  };
  const plainTerminal = memoryTerminal({ isTTY: false });
  new PlainReporter(plainTerminal.environment).buildWarnings([diagnostic]);
  assert.equal(
    plainTerminal.stderr(),
    "[mokly/warning] screens/home\\u001b[2J.desktop.html: warning\\u009b2J\n",
  );
  assert.ok(!plainTerminal.stderr().includes("\u001b"));
  assert.ok(!plainTerminal.stderr().includes("\u009b"));

  const richTerminal = memoryTerminal({ columns: 200, isTTY: true });
  new RichReporter(richTerminal.environment).buildWarnings([diagnostic]);
  assert.equal(
    richTerminal.stderr(),
    "  ! screens/home\\u001b[2J.desktop.html: warning\\u009b2J\n",
  );
  assert.ok(!richTerminal.stderr().includes("\u001b"));
  assert.ok(!richTerminal.stderr().includes("\u009b"));
});

test("rich reporter bounds build warning lines on stderr", () => {
  const terminal = memoryTerminal({ columns: 48, isTTY: true });
  const reporter = new RichReporter(terminal.environment);
  reporter.buildWarnings([
    {
      code: "link-control-ancestor",
      route: "screens/home.desktop.html",
      message: "MockLink child control is inside <button>",
    },
  ]);
  assert.equal(terminal.stdout(), "");
  assert.equal(
    terminal.stderr(),
    "  ! screens/home.desktop.html: MockLink child c…\n",
  );
});
