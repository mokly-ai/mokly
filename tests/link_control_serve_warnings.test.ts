import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import { PlainServeReporter } from "../dist/server/reporter.js";
import { serve } from "../dist/server/serve.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import {
  registerWarningPage,
  writeWarningPage,
} from "./helpers/link_control_warning_fixture.js";
import { waitUntil } from "./helpers/wait_until.js";
import {
  catalogue,
  version,
  waitForInitialChanges,
  waitForUpdate,
} from "./helpers/watched_catalogue.js";

const warning =
  "[mokly/warning] warning-page/index.html: MockLink child control is inside <button>; one click or key press has two targets\n";

test(
  "watched Serve reports each generation once and never an on-demand render",
  { timeout: 30_000 },
  async (t) => {
    const fixture = await createFixture();
    const sourcePath = await registerWarningPage(fixture, "Initial warning");
    const output: string[] = [];
    const running = await serve(
      await loadConfig(fixture.root),
      { port: 0, watch: true },
      { reporter: new PlainServeReporter((value) => output.push(value)) },
    );
    fixture.beforeRemove(() => running.close());
    t.after(() => removeFixture(fixture));

    const initial = await waitForInitialChanges(running.url, 30_000);
    await waitFor(() => warnings(output).length === 1);
    await requestWarningPage(running.url);
    assert.equal(warnings(output).length, 1);

    await writeWarningPage(sourcePath, "Rebuilt warning");
    await waitForUpdate(running.url, version(initial));
    const beforeRequest = warnings(output).length;
    await requestWarningPage(running.url);
    assert.equal(warnings(output).length, beforeRequest);
    await waitFor(() => warnings(output).length === 2);
    assert.deepEqual(warnings(output), [warning, warning]);

    await requestWarningPage(running.url);
    assert.equal(warnings(output).length, 2);
    assert.ok(version(await catalogue(running.url)) > version(initial));
  },
);

function warnings(output: readonly string[]): string[] {
  return output.filter((value) => value === warning);
}

async function requestWarningPage(url: string): Promise<void> {
  const response = await fetch(`${url}/static/warning-page/index.html`);
  assert.equal(response.status, 200);
  assert.match(
    await response.text(),
    /Warning control|Initial warning|Rebuilt warning/,
  );
}

async function waitFor(condition: () => boolean): Promise<void> {
  await waitUntil(condition, {
    timeoutMs: 15_000,
    intervalMs: 25,
    message: "warning report did not settle",
  });
}
