import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import { EARLIER_BASELINE_MESSAGE } from "../../dist/baseline/compatibility.js";
import { PlainReporter } from "../../dist/cli/reporter/plain.js";
import { serve } from "../../dist/server/serve.js";
import { waitFor } from "../server_fixture.js";

import { derivedFixture } from "./derived_fixture.js";
import { validEntrySource } from "./fixture.js";
import { memoryTerminal } from "./terminal.js";
import {
  version,
  waitForInitialChanges,
  waitForUpdate,
} from "./watched_catalogue.js";

/** Run the historical recipe in real Serve and retain its terminal/cache evidence. */
export async function assertRebuiltEarlierNotice(
  t: TestContext,
  watch: boolean,
) {
  const fixture = await derivedFixture(
    t,
    validEntrySource(),
    {},
    "watch: { debounceMs: 0 },",
  );
  await fs.writeFile(
    path.join(fixture.root, "baseline.mjs"),
    `import fs from "node:fs/promises";
await fs.rm("mockups/mokly-generated", { recursive: true, force: true });
await fs.mkdir("mockups", { recursive: true });
await fs.writeFile("mockups/mokly-manifest.json", JSON.stringify({ schemaVersion: 7 }));
`,
  );
  await fixture.git("add", "baseline.mjs");
  await fixture.git("commit", "-qm", "test: root-level v7 recipe");
  const first = (await fixture.git("rev-parse", "HEAD")).stdout.trim();
  await fixture.git(
    "commit",
    "--allow-empty",
    "-qm",
    "test: second earlier base",
  );
  const second = (await fixture.git("rev-parse", "HEAD")).stdout.trim();
  await fixture.git("update-ref", "refs/remotes/origin/main", first);
  const terminal = memoryTerminal({ isTTY: false });
  const running = await serve(
    fixture.config,
    { base: "origin/main", port: 0, watch },
    { reporter: new PlainReporter(terminal.environment) },
  );
  fixture.beforeRemove(() => running.close());
  const initial = await waitForInitialChanges(running.url);
  assert.match(initial, /data-changes-status="unavailable"/);
  assert.match(initial, /data-filter="all"/);
  const line = EARLIER_BASELINE_MESSAGE + "\n";
  assert.equal(terminal.stdout(), line);
  assert.equal(terminal.stderr(), "");
  await fs.writeFile(
    fixture.entryPath,
    validEntrySource({ body: "Changed live body" }),
  );
  if (watch) {
    await waitForUpdate(running.url, version(initial));
    await waitForInitialChanges(running.url);
    await waitFor(async () =>
      (
        await (
          await fetch(
            running.url + "/static/mokly-generated/home/index.mobile.html",
          )
        ).text()
      ).includes("Changed live body"),
    );
    assert.equal(
      terminal.stdout(),
      line,
      "content changes must not repeat the base notice",
    );
    for (const [commit, notices] of [
      [second, 2],
      [first, 3],
    ] as const) {
      await fixture.git("update-ref", "refs/remotes/origin/main", commit);
      await waitFor(async () => terminal.stdout() === line.repeat(notices));
      const html = await waitForInitialChanges(running.url);
      assert.match(html, /data-changes-status="unavailable"/);
      assert.equal(terminal.stdout(), line.repeat(notices));
    }
  } else {
    for (let request = 0; request < 3; request++) {
      const response = await fetch(
        running.url + "/static/mokly-generated/home/index.mobile.html",
      );
      assert.equal(response.status, 200);
      assert.doesNotMatch(await response.text(), /Changed live body/);
    }
    assert.equal(terminal.stdout(), line);
  }
  assert.equal(terminal.stderr(), "");
  for (const commit of [first, second])
    await assert.rejects(
      fs.stat(
        path.join(
          fixture.root,
          ".mokly-cache/baselines",
          commit,
          "complete.json",
        ),
      ),
      { code: "ENOENT" },
    );
}
