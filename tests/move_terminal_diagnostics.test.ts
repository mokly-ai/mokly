import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { writeCompilation } from "../packages/mokly/dist/build/transaction.js";
import { loadConfig } from "../packages/mokly/dist/config/load.js";
import { exportCatalogue } from "../packages/mokly/dist/export/run.js";
import { PlainServeReporter } from "../packages/mokly/dist/server/reporter.js";
import { serve } from "../packages/mokly/dist/server/serve.js";

import { movedCatalogueFixture } from "./helpers/move_catalogue.js";

const expected = [
  "new/guide: movedFrom vanished matched no removed baseline entry of kind document",
  "removed page old/page matches added entries new/duplicate and new/page; declare movedFrom to pair it",
];

async function diagnosticFixture(
  t: Parameters<typeof movedCatalogueFixture>[0],
) {
  const fixture = await movedCatalogueFixture(t);
  await fixture.write(
    "specs/new/guide.md",
    "---\nmovedFrom: vanished\n---\n# Guide\n\n## Start\n\nRead the guide.",
  );
  await fixture.write(
    "specs/new/duplicate.mockup.ts",
    await fs.readFile(
      path.join(fixture.root, "specs/new/page.mockup.ts"),
      "utf8",
    ),
  );
  await writeCompilation(await fixture.compile(), fixture.config);
  return { ...fixture, config: await loadConfig(fixture.root) };
}

for (const watch of [false, true])
  test(
    `Serve reports move diagnostics at accepted classification: watch=${watch}`,
    { timeout: 30_000 },
    async (t) => {
      const fixture = await diagnosticFixture(t);
      const lines: string[] = [];
      let resolve = () => {};
      let reject = (_error: Error) => {};
      const complete = new Promise<void>((done, fail) => {
        resolve = done;
        reject = fail;
      });
      class Reporter extends PlainServeReporter {
        override changesReady(): void {
          resolve();
        }
        override changesUnavailable(): void {
          reject(new Error(lines.join("\n")));
        }
      }
      const reporter = new Reporter((line) => lines.push(line.trimEnd()));
      const running = await serve(
        fixture.config,
        { port: 0, watch, base: "main" },
        { reporter },
      );
      fixture.beforeRemove(() => running.close());
      await complete;
      assert.deepEqual(lines, expected);
    },
  );

test(
  "export reports move diagnostics even though publication removes summary.md",
  { timeout: 30_000 },
  async (t) => {
    const fixture = await diagnosticFixture(t);
    const messages: string[] = [];
    await exportCatalogue(fixture.config, {
      outDir: "site",
      base: "HEAD",
      diagnostic: (message) => messages.push(message),
    });
    assert.deepEqual(messages, expected);
  },
);
