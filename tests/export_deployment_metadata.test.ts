import assert from "node:assert/strict";
import test from "node:test";

import { exportCatalogue } from "../dist/export/run.js";

import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";

const alterations: Record<string, (html: string) => string> = {
  missing: (html) => html.replace(/ data-mokly-delivery="[^"]+"/, ""),
  duplicate: (html) => html.replace(/( data-mokly-delivery="[^"]+")/, "$1$1"),
  malformed: (html) =>
    html.replace(/data-mokly-delivery="[^"]+"/, 'data-mokly-delivery="{}"'),
  unsupported: (html) =>
    html.replace("&quot;schemaVersion&quot;:5", "&quot;schemaVersion&quot;:3"),
  canonical: (html) =>
    html.replace(
      "&quot;canonicalPath&quot;:&quot;/&quot;",
      "&quot;canonicalPath&quot;:&quot;/404.html&quot;",
    ),
};

for (const [name, alter] of Object.entries(alterations)) {
  test(`adapter ${name} shell metadata fails before replacing the previous export`, async (context) => {
    const fixture = await createExportFixture();
    context.after(() => fixture.close());
    await exportCatalogue(fixture.config, { outDir: "site" });
    const previous = await directoryFiles(fixture.output);
    await assert.rejects(
      exportCatalogue(fixture.config, {
        outDir: "site",
        adapter: {
          transform: (files) => {
            files.set(
              "index.html",
              alter(Buffer.from(files.get("index.html")!).toString()),
            );
          },
        },
      }),
      /\[mokly\/export-invalid\].*shell.*metadata/i,
    );
    assert.deepEqual(await directoryFiles(fixture.output), previous);
  });
}
