import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import type { ComponentViewRecord } from "@mokly/viewer";
import type { ManifestV8 } from "@mokly/viewer/data";
import { generatedViews } from "@mokly/viewer/data";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";

import { componentEntrySource } from "./component_fixture.js";
import { createExportFixture } from "./export_fixture.js";

export const earlierBaselines = [
  { name: "main v7", version: 7 },
  { name: "v3", version: 3 },
  { name: "v4", version: 4 },
  { name: "v5", version: 5 },
  { name: "v6", version: 6 },
  { name: "mokabook sentinel", filename: "mokabook-manifest.json" },
  { name: "mockbook sentinel", filename: "mockbook-manifest.json" },
] as const;

export type EarlierV8Shape =
  "missing root" | "missing provenance" | "CSS owners";

export function earlierV8Manifest(
  manifest: ManifestV8,
  shape: EarlierV8Shape,
): ManifestV8 {
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
      entry.id === "action-default"
        ? { ...entry, componentViews: entry.componentViews.map(alter) }
        : entry,
    ),
  };
}

export async function currentBaselineFixture(
  context: TestContext,
  baseline:
    { version: number } | { filename: string } | { shape: EarlierV8Shape },
) {
  const fixture = await createExportFixture(componentEntrySource());
  context.after(() => fixture.close());
  const compilation = await compileCatalogue(fixture.config);
  const canonical = path.join(fixture.mockupsDir, "mokly-manifest.json");
  if ("filename" in baseline) {
    await fs.rename(
      canonical,
      path.join(fixture.mockupsDir, baseline.filename),
    );
    await fs.writeFile(
      path.join(fixture.mockupsDir, baseline.filename),
      "not JSON; sentinel only",
    );
  } else {
    const manifest =
      "version" in baseline
        ? { ...compilation.manifest, schemaVersion: baseline.version }
        : earlierV8Manifest(compilation.manifest, baseline.shape);
    await fs.writeFile(canonical, JSON.stringify(manifest));
    if ("shape" in baseline && baseline.shape === "missing root") {
      const entry = compilation.manifest.entries.find(
        (entry) => entry.id === "action-default",
      )!;
      for (const view of generatedViews(entry)) {
        const content = compilation.outputs.get(view.path);
        if (typeof content !== "string")
          throw new Error("fixture needs an HTML view");
        await fs.writeFile(
          path.join(fixture.mockupsDir, view.path),
          content.replace(/<!--mokly-component:(?:start|end):r-0-->/g, ""),
        );
      }
    }
  }
  await fixture.git("add", "-A");
  await fixture.git("commit", "-qm", "test: selected baseline contract");
  await fixture.git("update-ref", "refs/remotes/origin/main", "HEAD");
  await writeCompilation(compilation, fixture.config);
  return { ...fixture, compilation };
}
