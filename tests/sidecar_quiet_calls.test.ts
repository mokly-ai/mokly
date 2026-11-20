import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";

import { consumer } from "./helpers/mokly_serve.js";
import {
  bundleParams,
  installBindings,
  startSidecar,
} from "./helpers/sidecar.js";

const page = `import {definePage} from '@mokly/mokly';
let renders = 0;
export default definePage({title:'Log',description:'',relatedDocs:[],render() {
  renders += 1;
  console.log('console-' + renders);
  process.stdout.write('stdout-' + renders + '\\n');
  process.stderr.write('stderr-' + renders + '\\n');
  const render = renders;
  setTimeout(() => console.log('timer-' + render), 0);
  return '<!doctype html><html><head></head><body>Log</body></html>';
}});
`;

/** Wait for an expected stderr line within the ten-second polling allowance. */
async function stderrLine(
  sidecar: ReturnType<typeof startSidecar>,
  line: string,
) {
  const deadline = Date.now() + 10_000;
  while (!sidecar.stderr().split("\n").includes(line)) {
    assert.ok(Date.now() < deadline, `missing stderr line ${line}`);
    await delay(10);
  }
}

test(
  "a quiet call drops its own consumer output but keeps its timing records, its later timers, and the next call",
  { timeout: 120_000 },
  async (context) => {
    const root = await consumer(context, { "specs/log.mockup.ts": page });
    const sidecar = startSidecar(context, root);
    await sidecar.call("hello", { timings: true });
    const { generation } = await sidecar.call<BundleResult>(
      "bundle",
      bundleParams({
        sourceRoot: root,
        renderer: null,
        entryFiles: ["specs/log.mockup.ts"],
        storiesFiles: [],
      }),
    );
    await sidecar.call("cssModules", { generation, classMaps: {} });
    await installBindings(sidecar, generation);
    const render = { generation, handle: "specs/log.mockup.ts#default" };
    await sidecar.call("renderPage", render, { quiet: true });
    await sidecar.call("renderPage", render);
    await stderrLine(sidecar, "timer-2");
    await sidecar.call("shutdown");
    const lines = sidecar.stderr().split("\n");
    const consumerLines = lines.filter(
      (line) => line && !line.startsWith("[mokly:timing] "),
    );
    const renders = lines
      .filter((line) => line.startsWith("[mokly:timing] "))
      .map((line) => JSON.parse(line.slice(15)) as Record<string, unknown>)
      .filter((record) => record.stage === "sidecar.render");
    assert.deepEqual(consumerLines.toSorted(), [
      "console-2",
      "stderr-2",
      "stdout-2",
      "timer-1",
      "timer-2",
    ]);
    assert.deepEqual(
      renders.map((record) => record.event),
      ["start", "end", "start", "end"],
      "the quiet render keeps its timing records",
    );
  },
);
