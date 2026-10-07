import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { gitBlobHash } from "../../dist/registry/blob_hash.js";
import { parseHistoricalManifest } from "../../dist/registry/manifest.js";

import { componentEntrySource } from "./component_fixture.js";
import { createExportFixture } from "./export_fixture.js";

/** Commit valid current v9 metadata whose ranges use unsupported comment spelling. */
export async function formerMarkerBaselineFixture(context: TestContext) {
  const fixture = await createExportFixture(componentEntrySource());
  context.after(() => fixture.close());
  const compilation = await compileCatalogue(fixture.config);
  const files = new Map(
    [...compilation.outputs].map(([route, content]) => [
      route,
      typeof content === "string" && route.endsWith(".html")
        ? content.replaceAll("<!--mokly-component:", "<!--mokabook-component:")
        : content,
    ]),
  );
  const manifest = {
    ...compilation.manifest,
    generatedFiles: compilation.manifest.generatedFiles.map((file) => ({
      ...file,
      blobHash: gitBlobHash(
        Buffer.from(files.get(file.path)!),
        compilation.manifest.blobHashAlgorithm,
      ),
    })),
  };
  parseHistoricalManifest(manifest);
  await fs.writeFile(
    path.join(fixture.config.generatedDir, "mokly-manifest.json"),
    JSON.stringify(manifest),
  );
  for (const [route, content] of files) {
    if (typeof content !== "string" || !route.endsWith(".html")) continue;
    await fs.writeFile(path.join(fixture.config.generatedDir, route), content);
  }
  await fixture.git("add", "-A");
  await fixture.git("commit", "-qm", "test: former component marker baseline");
  await fixture.git("update-ref", "refs/remotes/origin/main", "HEAD");
  await writeCompilation(compilation, fixture.config);
  await fixture.git("add", "mockups/mokly-generated");
  await fixture.git(
    "commit",
    "-qm",
    "test: commit current marker fixture output",
  );
  return { ...fixture, compilation };
}
