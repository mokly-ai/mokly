import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { EARLIER_BASELINE_MESSAGE } from "../dist/baseline/compatibility.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { PlainReporter } from "../dist/cli/reporter/plain.js";
import { serve } from "../dist/server/serve.js";

import { derivedFixture } from "./helpers/derived_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";
import { memoryTerminal } from "./helpers/terminal.js";
import {
  version,
  waitForInitialChanges,
  waitForUpdate,
} from "./helpers/watched_catalogue.js";
import { waitFor } from "./server_fixture.js";

test(
  "real watched Serve prints an earlier notice once and resets through a successful blob base",
  { timeout: 60_000 },
  async (t) => {
    const fixture = await derivedFixture(
      t,
      validEntrySource(),
      {},
      "watch: { debounceMs: 0 },",
    );
    await fs.mkdir(fixture.generatedDir, { recursive: true });
    await fs.writeFile(
      path.join(fixture.generatedDir, "mokly-manifest.json"),
      JSON.stringify({ schemaVersion: 7 }),
    );
    await fixture.git("add", "-f", "mockups/mokly-generated");
    await fixture.git("commit", "-qm", "test: earlier baseline");
    const earlier = (await fixture.git("rev-parse", "HEAD")).stdout.trim();
    await writeCompilation(fixture.baseline, fixture.config);
    await fixture.git("add", "-f", "mockups/mokly-generated");
    await fixture.git("commit", "-qm", "test: current baseline");
    const current = (await fixture.git("rev-parse", "HEAD")).stdout.trim();
    await fixture.git("update-ref", "refs/remotes/origin/main", earlier);
    const terminal = memoryTerminal({ isTTY: false });
    const running = await serve(
      fixture.config,
      { base: "origin/main", port: 0, watch: true },
      {
        reporter: new PlainReporter(terminal.environment),
      },
    );
    fixture.beforeRemove(() => running.close());
    const count = () =>
      terminal.stdout().split(EARLIER_BASELINE_MESSAGE).length - 1;
    const initial = await waitForInitialChanges(running.url);
    assert.match(initial, /data-changes-status="unavailable"/);
    assert.equal(count(), 1);
    await fs.writeFile(
      fixture.entryPath,
      validEntrySource({ body: "Current content edit" }),
    );
    await waitForUpdate(running.url, version(initial));
    await waitForInitialChanges(running.url);
    assert.equal(
      count(),
      1,
      "content changes retain the accepted-base notice state",
    );
    await fixture.git("update-ref", "refs/remotes/origin/main", current);
    await waitFor(async () =>
      (await (await fetch(running.url)).text()).includes(
        'data-changes-status="ready"',
      ),
    );
    assert.equal(count(), 1);
    await fixture.git("update-ref", "refs/remotes/origin/main", earlier);
    await waitFor(
      async () =>
        count() === 2 &&
        (await (await fetch(running.url)).text()).includes(
          'data-changes-status="unavailable"',
        ),
    );
    assert.equal(
      terminal.stdout(),
      `${EARLIER_BASELINE_MESSAGE}\n${EARLIER_BASELINE_MESSAGE}\n`,
    );
    assert.equal(terminal.stderr(), "");
  },
);
