import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import type { ComponentViewRecord } from "@mokly/viewer";
import type { ManifestV9 } from "@mokly/viewer/data";
import { generatedViews } from "@mokly/viewer/data";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";

import { componentEntrySource } from "./component_fixture.js";
import { createExportFixture } from "./export_fixture.js";

export const earlierBaselines = [
  { name: "previous v8", version: 8 },
  { name: "v7", version: 7 },
  { name: "v3", version: 3 },
  { name: "v4", version: 4 },
  { name: "v5", version: 5 },
  { name: "v6", version: 6 },
  {
    name: "former mokabook filename without canonical output",
    filename: "mokabook-manifest.json",
  },
  {
    name: "former mockbook filename without canonical output",
    filename: "mockbook-manifest.json",
  },
] as const;

export type InvalidCurrentShape =
  "missing root" | "missing provenance" | "CSS owners";

export function invalidCurrentManifest(
  manifest: ManifestV9,
  shape: InvalidCurrentShape,
): ManifestV9 {
  const alter = (view: ComponentViewRecord): ComponentViewRecord => {
    if (shape === "missing root") return { ...view, ranges: [] };
    if (shape === "CSS owners")
      return {
        ...view,
        resources: [{ path: "old.css", componentIds: ["action"] }],
      };
    const { insertedStylesheets: _provenance, ...without } = view;
    return without;
  };
  return {
    ...manifest,
    entries: manifest.entries.map((entry) =>
      entry.kind === "component" &&
      "variantOf" in entry &&
      entry.path === "action/default"
        ? { ...entry, componentViews: entry.componentViews.map(alter) }
        : entry,
    ),
  };
}

export async function currentBaselineFixture(
  context: TestContext,
  baseline:
    { version: number } | { filename: string } | { shape: InvalidCurrentShape },
) {
  const fixture = await createExportFixture(componentEntrySource());
  context.after(() => fixture.close());
  if ("filename" in baseline) {
    await fs.writeFile(
      fixture.configPath,
      (await fs.readFile(fixture.configPath, "utf8")).replace(
        'review: { outDir: ".review" }',
        'review: { outDir: ".review", baselineBuild: [["node", "baseline.mjs"]] }',
      ),
    );
    await fs.appendFile(path.join(fixture.root, ".gitignore"), ".context/\n");
    fixture.config = await loadConfig(fixture.root);
  }
  const compilation = await compileCatalogue(fixture.config);
  const canonical = path.join(
    fixture.config.generatedDir,
    "mokly-manifest.json",
  );
  if ("filename" in baseline) {
    const rebuildLog = path.join(fixture.root, ".context/baseline-rebuild.log");
    await fs.mkdir(path.dirname(rebuildLog), { recursive: true });
    await fs.rename(
      canonical,
      path.join(fixture.mockupsDir, baseline.filename),
    );
    await fs.writeFile(
      path.join(fixture.mockupsDir, baseline.filename),
      "not JSON; not a canonical manifest",
    );
    await fs.writeFile(
      path.join(fixture.root, "baseline-output.json"),
      JSON.stringify(
        [...compilation.outputs].map(([route, value]) => [
          route,
          Buffer.from(value).toString("base64"),
        ]),
      ),
    );
    await fs.writeFile(
      path.join(fixture.root, "baseline.mjs"),
      `import fs from "node:fs/promises";
import path from "node:path";
for (const [route, encoded] of JSON.parse(await fs.readFile("baseline-output.json", "utf8"))) {
  const target = path.join("mockups/mokly-generated", route);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, Buffer.from(encoded, "base64"));
}
await fs.appendFile(${JSON.stringify(rebuildLog)}, "build\\n");
`,
    );
  } else {
    const manifest =
      "version" in baseline
        ? { ...compilation.manifest, schemaVersion: baseline.version }
        : invalidCurrentManifest(compilation.manifest, baseline.shape);
    await fs.writeFile(canonical, JSON.stringify(manifest));
    if ("shape" in baseline && baseline.shape === "missing root") {
      const entry = compilation.manifest.entries.find(
        (entry) => entry.path === "action/default",
      )!;
      for (const view of generatedViews(entry)) {
        const content = compilation.outputs.get(view.path);
        if (typeof content !== "string")
          throw new Error("fixture needs an HTML view");
        await fs.writeFile(
          path.join(fixture.config.generatedDir, view.path),
          content.replace(/<!--mokly-component:(?:start|end):r-0-->/g, ""),
        );
      }
    }
  }
  await fixture.git("add", "-A");
  await fixture.git("commit", "-qm", "test: selected baseline contract");
  await fixture.git("update-ref", "refs/remotes/origin/main", "HEAD");
  await writeCompilation(compilation, fixture.config);
  return {
    ...fixture,
    compilation,
    rebuilds: async () =>
      (
        await fs.readFile(
          path.join(fixture.root, ".context/baseline-rebuild.log"),
          "utf8",
        )
      )
        .split("\n")
        .filter(Boolean).length,
  };
}
