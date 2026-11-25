import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import type { ViteCssResult } from "../packages/mokly/src/generated/sidecar/ViteCssResult.js";

import { reviewFixture, reviewPage } from "./fixtures/vite_review.js";

test("Vite keeps reports from nested JavaScript loads that return no code", async (context) => {
  const fixture = await nestedReportsFixture(context, "src/review.mockup.ts");
  await fixture.write("src/review.mockup.ts", reviewPage('"page"'));
  const bundle = await fixture.compile();
  assert.equal(
    bundle.compiled.metadataInputs["data/helper-input.txt"],
    createHash("sha256").update("helper input").digest("hex"),
  );
  assert.equal(
    bundle.compiled.metadataInputs["data/copy.txt"],
    createHash("sha256").update("before").digest("hex"),
  );
  await fixture.write("data/copy.txt", "after");
  await assert.rejects(fixture.compile(), { code: "fresh-worker-required" });
  await fixture.sidecar.call("shutdown");
});

test("Vite keeps reports from nested loads as inline stylesheet dependencies", async (context) => {
  const stylesheet = "styles/site.css";
  const fixture = await nestedReportsFixture(context, `${stylesheet}?inline`);
  await fixture.write(stylesheet, ".site { color: teal }");
  const result = await fixture.sidecar.call<ViteCssResult>("transformViteCss", {
    setup: { ...fixture.params, entryFiles: [] },
    stylesheet,
    file: path.join(fixture.root, stylesheet),
  });
  assert.equal(
    result.dependencies["data/copy.txt"],
    createHash("sha256").update("before").digest("hex"),
  );
  assert.equal(result.importedBy["data/copy.txt"], undefined);
  await fixture.sidecar.call("shutdown");
});

test("Vite keeps resolveId reports as inputs of the importer", async (context) => {
  const fixture = await reviewFixture(context);
  await fixture.write("data/resolve.txt", "before");
  await fixture.write("src/value.js", 'export default "page";');
  await fixture.write(
    "src/review.mockup.ts",
    reviewPage("value", 'import value from "./value.js";'),
  );
  await fixture.write(
    "vite.config.ts",
    `import { resolve } from "node:path";
     export default { plugins: [{ name: "resolve-report", resolveId: {
       order: "pre",
       handler(source, importer) {
         if (source === "./value.js" && importer?.endsWith("/review.mockup.ts"))
           this.addWatchFile(resolve(import.meta.dirname, "data/resolve.txt"));
       },
     } }] };`,
  );
  const bundle = await fixture.compile();
  assert.equal(
    bundle.compiled.metadataInputs["data/resolve.txt"],
    createHash("sha256").update("before").digest("hex"),
  );
  await fixture.write("data/resolve.txt", "after");
  await assert.rejects(fixture.compile(), { code: "fresh-worker-required" });
  await fixture.sidecar.call("shutdown");
});

async function nestedReportsFixture(context: TestContext, importer: string) {
  const fixture = await reviewFixture(context);
  await fixture.write("data/helper.js", "export {};");
  await fixture.write("data/helper-input.txt", "helper input");
  await fixture.write("data/copy.txt", "before");
  await fixture.write(
    "vite.config.ts",
    `import { resolve } from "node:path";
     const helper = resolve(import.meta.dirname, "data/helper.js");
     const leaf = "\\0watch-only";
     export default { plugins: [{ name: "nested-load-reports",
       resolveId(source) { if (source === leaf) return leaf; },
       async load(id) {
         if (id === helper) {
           await this.load({ id: leaf });
           return "export {};";
         }
         if (id === leaf)
           this.addWatchFile(resolve(import.meta.dirname, "data/copy.txt"));
       },
       async transform(_code, id) {
         if (id === helper)
           this.addWatchFile(resolve(import.meta.dirname, "data/helper-input.txt"));
         if (id.endsWith(${JSON.stringify(`/${importer}`)})) await this.load({ id: helper });
       },
     }] };`,
  );
  return fixture;
}
