import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeBuildDiagnostics,
  type BuildDiagnostic,
} from "../dist/build/build_warnings.js";
import { PlainReporter } from "../dist/cli/reporter/plain.js";
import { RichReporter } from "../dist/cli/reporter/rich.js";

import { memoryTerminal } from "./helpers/terminal.js";

for (const kind of ["entry", "component", "folder", "configuration"] as const) {
  for (const mode of ["plain", "rich"] as const) {
    test(`${mode} warnings print a ${kind} subject exactly once`, () => {
      const terminal = memoryTerminal({ columns: 240, isTTY: false });
      const reporter =
        mode === "plain"
          ? new PlainReporter(terminal.environment)
          : new RichReporter(terminal.environment);
      const diagnostic = {
        code: "removed-dependencies",
        subject: { kind, path: "specs/home" },
        message:
          "dependencies has been removed; ignoring it. Delete the field.",
      } as BuildDiagnostic;
      try {
        reporter.buildWarnings(normalizeBuildDiagnostics([diagnostic]));
        assert.equal(terminal.stdout(), "");
        assert.equal(
          terminal.stderr(),
          `${mode === "plain" ? "[mokly/warning]" : "  !"} ${kind} "specs/home": ${diagnostic.message}\n`,
        );
      } finally {
        reporter.close();
      }
    });
  }
}

test("subjects sort with routes and preserve route-only sorting", () => {
  const records = [
    {
      code: "removed-dependencies",
      subject: { kind: "entry", path: "home" },
      message: "Removed",
    },
    {
      code: "link-control-ancestor",
      route: "a/index.html",
      message: "Control",
    },
    {
      code: "removed-shared-impact",
      subject: { kind: "configuration", path: "mokly.config.ts" },
      message: "Removed",
    },
  ] as BuildDiagnostic[];
  assert.deepEqual(normalizeBuildDiagnostics([...records, records[0]!]), [
    records[1],
    records[2],
    records[0],
  ]);
});

test("diagnostics reject missing, ambiguous and unsafe subjects", () => {
  for (const subject of [
    { kind: "unknown", path: "home" },
    { kind: "entry", path: "../home" },
    { kind: "entry", path: "" },
    { kind: "configuration", path: "/tmp/config.ts" },
    { kind: "component", path: "bad\u001bpath" },
  ]) {
    assert.throws(() =>
      normalizeBuildDiagnostics([
        {
          code: "removed-dependencies",
          subject,
          message: "Removed",
        } as BuildDiagnostic,
      ]),
    );
  }
  assert.throws(() =>
    normalizeBuildDiagnostics([
      {
        code: "link-control-ancestor",
        route: "home.html",
        subject: { kind: "entry", path: "home" },
        message: "Control",
      } as unknown as BuildDiagnostic,
    ]),
  );
});

test("equal printed locations keep different route and subject identities", () => {
  const entry: BuildDiagnostic = {
    code: "removed-dependencies",
    subject: { kind: "entry", path: "home" },
    message: "Removed",
  };
  const route: BuildDiagnostic = {
    code: "removed-dependencies",
    route: 'entry "home"',
    message: "Removed",
  };
  assert.deepEqual(normalizeBuildDiagnostics([entry, route, entry]), [
    route,
    entry,
  ]);
});

test("subject reporters escape terminal controls and accept the root folder", () => {
  const terminal = memoryTerminal({ isTTY: false });
  const reporter = new PlainReporter(terminal.environment);
  reporter.buildWarnings([
    {
      code: "removed-dependencies",
      subject: { kind: "entry", path: "a\u009b2J" },
      message: "Removed\u001b[2J",
    },
  ]);
  reporter.buildWarnings(
    normalizeBuildDiagnostics([
      {
        code: "removed-dependencies",
        subject: { kind: "folder", path: "" },
        message: "Removed",
      },
    ]),
  );
  assert.equal(
    terminal.stderr(),
    '[mokly/warning] entry "a\\u009b2J": Removed\\u001b[2J\n[mokly/warning] folder "": Removed\n',
  );
});
