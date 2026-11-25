import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";

import {
  pluginInput,
  pluginInputFixture,
} from "./fixtures/vite_plugin_inputs.js";
import { reviewFixture, reviewPage } from "./fixtures/vite_review.js";

const reports: ReadonlyArray<{
  method: "load" | "addWatchFile";
  ordered?: boolean;
  sameImporter?: boolean;
  importer: string;
}> = [
  { method: "load", importer: "another page imports them" },
  { method: "addWatchFile", importer: "another page imports them" },
  {
    method: "addWatchFile",
    sameImporter: true,
    importer: "the reporting module also imports them",
  },
  {
    method: "load",
    ordered: true,
    importer: "an ordered transform loads them",
  },
];

for (const {
  method,
  ordered = false,
  sameImporter = false,
  importer,
} of reports) {
  test(`Vite keeps this.${method} inputs shared when ${importer}`, async (context) => {
    const fixture = await pluginInputFixture(context, method, {
      ordered,
      sameImporter,
    });
    const compile = () =>
      fixture.sidecar.call<BundleResult>("bundle", {
        ...fixture.params,
        capture: "serveEdit",
      });
    const before = await compile();
    assert.equal(
      before.compiled.metadataInputs["src/plugin-input.ts"],
      createHash("sha256").update(pluginInput).digest("hex"),
    );
    assert.equal(
      before.modules.filter((module) => module.path === "src/plugin-input.ts")
        .length,
      1,
    );
    assert.equal(
      before.compiled.metadataInputs["src/other.mockup.ts"],
      undefined,
    );
    assert.equal(
      (await fixture.render(before)).html,
      `<html><head></head><body>${sameImporter ? "before|" : ""}export const value = "before";</body></html>`,
    );
    const unchanged = await compile();
    assert.equal(
      unchanged.compiled.metadataInputs["src/plugin-input.ts"],
      before.compiled.metadataInputs["src/plugin-input.ts"],
    );
    assert.equal(
      await fs.readFile(path.join(fixture.root, ".context/setups"), "utf8"),
      "setup\n",
    );
    await fixture.write("src/plugin-input.ts", 'export const value = "after";');
    const after = await compile();
    assert.equal(
      (await fixture.render(after)).html,
      `<html><head></head><body>${sameImporter ? "after|" : ""}export const value = "after";</body></html>`,
    );
    assert.equal(
      await fs.readFile(path.join(fixture.root, ".context/setups"), "utf8"),
      "setup\nsetup\n",
    );
    assert.equal(
      (await fixture.render(before)).html,
      `<html><head></head><body>${sameImporter ? "before|" : ""}export const value = "before";</body></html>`,
    );
    await fixture.sidecar.call("shutdown");
  });
}

test("Vite records a plugin input before an edit made after the report", async (context) => {
  const fixture = await reviewFixture(context);
  await fixture.write("data/copy.txt", "before");
  await fixture.write("src/review.mockup.ts", reviewPage("__COPY__"));
  await fixture.write(
    "vite.config.ts",
    `import { readFileSync, writeFileSync } from "node:fs";
     import { resolve } from "node:path";
     const file = resolve(import.meta.dirname, "data/copy.txt");
     export default { plugins: [{ name: "report-then-edit",
       transform(code, id) {
         if (!id.endsWith("/review.mockup.ts")) return;
         const value = readFileSync(file, "utf8");
         this.addWatchFile(file);
         if (value === "before") writeFileSync(file, "after");
         return code.replace("__COPY__", JSON.stringify(value));
       },
     }] };`,
  );
  const first = await fixture.compile();
  assert.equal(
    first.compiled.metadataInputs["data/copy.txt"],
    createHash("sha256").update("before").digest("hex"),
  );
  assert.match((await fixture.render(first)).html, /<body>before<\/body>/);
  assert.match(
    (await fixture.render(await fixture.compile())).html,
    /<body>after<\/body>/,
  );
  await fixture.sidecar.call("shutdown");
});

test("Vite drops a load report when the reporting module stops using it", async (context) => {
  const fixture = await reviewFixture(context);
  await fixture.write("data/plugin-only.ts", 'export const label = "plugin";');
  await fixture.write("src/review.mockup.ts", reviewPage('"reported"'));
  await fixture.write(
    "vite.config.ts",
    `import { resolve } from "node:path";
     export default { plugins: [{ name: "conditional-load", async transform(code, id) {
       if (id.endsWith("/review.mockup.ts") && code.includes('"reported"'))
         await this.load({ id: resolve(import.meta.dirname, "data/plugin-only.ts") });
     } }] };`,
  );
  const first = await fixture.compile();
  assert.equal(
    first.compiled.metadataInputs["data/plugin-only.ts"],
    createHash("sha256").update('export const label = "plugin";').digest("hex"),
  );
  await fixture.write("src/review.mockup.ts", reviewPage('"updated"'));
  const next = await fixture.compile();
  assert.equal(next.compiled.metadataInputs["data/plugin-only.ts"], undefined);
  assert.match((await fixture.render(next)).html, /<body>updated<\/body>/);
  await fixture.sidecar.call("shutdown");
});

test("Vite keeps a cached transform's reports after a separate plugin load", async (context) => {
  const fixture = await reviewFixture(context);
  await fixture.write("data/copy.txt", "copy");
  await fixture.write("src/review.mockup.ts", reviewPage('"initial"'));
  await fixture.write("src/other.mockup.ts", reviewPage('"other"'));
  fixture.params.entryFiles.push("src/other.mockup.ts");
  await fixture.write(
    "vite.config.ts",
    `import { resolve } from "node:path";
     export default { plugins: [{ name: "load-cached-module", async transform(code, id) {
       if (id.endsWith("/other.mockup.ts"))
         this.addWatchFile(resolve(import.meta.dirname, "data/copy.txt"));
       if (id.endsWith("/review.mockup.ts") && code.includes('"changed"'))
         await this.load({ id: resolve(import.meta.dirname, "src/other.mockup.ts") });
     } }] };`,
  );
  const digest = createHash("sha256").update("copy").digest("hex");
  const first = await fixture.compile();
  assert.equal(first.compiled.metadataInputs["data/copy.txt"], digest);
  await fixture.write("src/review.mockup.ts", reviewPage('"changed"'));
  const second = await fixture.compile();
  assert.equal(second.compiled.metadataInputs["data/copy.txt"], digest);
  assert.match((await fixture.render(second)).html, /<body>changed<\/body>/);
  await fixture.sidecar.call("shutdown");
});

test("Vite skips a plugin watch report outside selected roots with a diagnostic event", async (context) => {
  const fixture = await reviewFixture(context);
  const outside = path.join(fixture.parent, "outside.txt");
  await fs.writeFile(outside, "outside");
  await fixture.write(
    "vite.config.ts",
    `export default { plugins: [{ name: "outside-report",
    transform(code, id) { if (id.endsWith("/review.mockup.ts")) this.addWatchFile(${JSON.stringify(outside)}); },
  }] };`,
  );
  await fixture.write("src/review.mockup.ts", reviewPage('"inside"'));
  const { diagnostics } = fixture.sidecar;
  await assert.doesNotReject(async () => {
    const result = await fixture.compile();
    assert.equal(Object.hasOwn(result.compiled.inputs, outside), false);
    assert.equal(
      (await fixture.render(result)).html,
      "<html><head></head><body>inside</body></html>",
    );
  });
  assert.equal(diagnostics.length, 1);
  assert.match(diagnostics[0]!, /outside\.txt.*outside.*roots/);
  assert.doesNotMatch(diagnostics[0]!, new RegExp(fixture.parent));
  await fixture.sidecar.call("shutdown");
});

test("Vite directory watch reports keep valid transforms working", async (context) => {
  const fixture = await reviewFixture(context);
  await fixture.write(
    "vite.config.ts",
    `
    import path from "node:path";
    export default { plugins: [{ name: "directory-report",
      transform(code, id) {
        if (!id.endsWith("/review.mockup.ts")) return;
        this.addWatchFile(path.join(import.meta.dirname, "src"));
        this.addWatchFile(path.join(import.meta.dirname, "src/optional.txt"));
      },
    }] };
  `,
  );
  await fixture.write("src/review.mockup.ts", reviewPage('"inside"'));
  await assert.doesNotReject(async () => {
    const bundle = await fixture.compile();
    assert.equal(
      (await fixture.render(bundle)).html,
      "<html><head></head><body>inside</body></html>",
    );
    assert.equal(bundle.compiled.metadataInputs.src, undefined);
    assert.equal(bundle.compiled.metadataInputs["src/optional.txt"], null);
  });
  assert.equal(fixture.sidecar.diagnostics.length, 1);
  assert.match(
    fixture.sidecar.diagnostics[0]!,
    /plugin input src .*Serve does not watch.*watch\.rules.*rebuild/,
  );
  await fs.mkdir(path.join(fixture.root, "src/optional.txt"));
  const changed = await fixture.compile();
  assert.equal(changed.compiled.metadataInputs["src/optional.txt"], undefined);
  assert.match(
    fixture.sidecar.diagnostics.at(-1)!,
    /plugin input src\/optional\.txt /,
  );
  await fixture.sidecar.call("shutdown");
});
