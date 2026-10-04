import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { parseHistoricalManifest } from "../../dist/registry/manifest.js";

import { componentEntrySource } from "./component_fixture.js";
import { createExportFixture } from "./export_fixture.js";
import { historicalPaths } from "./historical_layout_fixture.js";

/** Commit valid v5 metadata whose expected ranges use unsupported comment spelling. */
export async function formerMarkerBaselineFixture(context: TestContext) {
  const fixture = await createExportFixture(componentEntrySource());
  context.after(() => fixture.close());
  const compilation = await compileCatalogue(fixture.config);
  const manifest = historicalPaths(compilation.manifest, 5);
  parseHistoricalManifest(manifest);
  await fs.writeFile(
    path.join(fixture.mockupsDir, "mokly-manifest.json"),
    JSON.stringify(manifest),
  );
  for (const [route, content] of compilation.outputs) {
    if (typeof content !== "string" || !route.endsWith(".html")) continue;
    await fs.writeFile(
      path.join(fixture.mockupsDir, route),
      content.replaceAll("<!--mokly-component:", "<!--mokabook-component:"),
    );
  }
  await fixture.git("add", "-A");
  await fixture.git("commit", "-qm", "test: former component marker baseline");
  await fixture.git("update-ref", "refs/remotes/origin/main", "HEAD");
  await writeCompilation(compilation, fixture.config);
  return { ...fixture, compilation };
}
