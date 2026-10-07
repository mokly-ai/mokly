import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { writeCompilation } from "../dist/build/transaction.js";
import { run } from "../dist/cli/run.js";

import { derivedFixture } from "./helpers/derived_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";
import { memoryTerminal } from "./helpers/terminal.js";

for (const warning of [false, true]) {
  test(`export sends a successful rebuild note to stdout beside build warnings (warning=${warning})`, async (t) => {
    const source =
      validEntrySource() +
      (warning
        ? `
      import { definePage, MockLink } from "@mokly/mokly";
      import { renderToStaticMarkup } from "react-dom/server";
      mockups.push(definePage({ path: "warning", title: "Warning", description: "Warning page", dependencies: [], relatedDocs: [],
        render: () => '<!doctype html><html><head><title>Warning</title></head><body>' + renderToStaticMarkup(<button><MockLink asChild to="details"><span>Go</span></MockLink></button>) + '</body></html>'
      }));`
        : "");
    const fixture = await derivedFixture(t, source);
    await writeCompilation(fixture.baseline, fixture.config);
    await fs.appendFile(
      path.join(fixture.generatedDir, "home/index.mobile.html"),
      "stale bytes",
    );
    await fixture.git("add", "-f", "mockups/mokly-generated");
    await fixture.git("commit", "-qm", "test: stale baseline output");
    const terminal = memoryTerminal({ isTTY: false });
    assert.equal(
      await run(
        [
          "export",
          "--config",
          fixture.configPath,
          "--base",
          "HEAD",
          "--out",
          "site",
        ],
        fixture.root,
        terminal.environment,
      ),
      0,
    );
    assert.match(
      terminal.stdout(),
      /Mokly baseline [a-f0-9]+: rebuilding because generated output has mismatched blob hashes: home\/index.mobile.html\./,
    );
    assert.match(terminal.stdout(), /Exported Mokly to /);
    if (warning)
      assert.match(
        terminal.stderr(),
        /^\[mokly\/warning\] warning\/index.html:.*\n$/,
      );
    else assert.equal(terminal.stderr(), "");
    assert.doesNotMatch(terminal.stderr(), /rebuilding because/);
  });
}
