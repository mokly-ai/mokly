import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";

import {
  pluginInput,
  pluginInputFixture,
} from "./fixtures/vite_plugin_inputs.js";
import { reviewFixture, reviewPage } from "./fixtures/vite_review.js";

for (const method of ["load", "addWatchFile"] as const) {
  test(`Vite keeps this.${method} inputs shared when another page imports them`, async (context) => {
    const fixture = await pluginInputFixture(context, method);
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
      '<html><head></head><body>export const value = "before";</body></html>',
    );
    const unchanged = await compile();
    assert.equal(
      unchanged.compiled.metadataInputs["src/plugin-input.ts"],
      before.compiled.metadataInputs["src/plugin-input.ts"],
    );
    await fixture.write("src/plugin-input.ts", 'export const value = "after";');
    const after = await compile();
    assert.equal(
      (await fixture.render(after)).html,
      '<html><head></head><body>export const value = "after";</body></html>',
    );
    assert.equal(
      await fs.readFile(path.join(fixture.root, ".context/setups"), "utf8"),
      "setup\nsetup\n",
    );
    assert.equal(
      (await fixture.render(before)).html,
      '<html><head></head><body>export const value = "before";</body></html>',
    );
    await fixture.sidecar.call("shutdown");
  });
}

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
  const diagnostics: string[] = [];
  const frames = createInterface({ input: fixture.sidecar.child.stdout });
  context.after(() => frames.close());
  frames.on("line", (line) => {
    const value: unknown = JSON.parse(line);
    if (
      value &&
      typeof value === "object" &&
      "event" in value &&
      value.event === "diagnostic" &&
      "params" in value
    ) {
      const params = value.params;
      if (params && typeof params === "object" && "message" in params)
        diagnostics.push(String(params.message));
    }
  });
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
        if (id.endsWith("/review.mockup.ts")) this.addWatchFile(path.join(import.meta.dirname, "src"));
      },
    }] };
  `,
  );
  await fixture.write("src/review.mockup.ts", reviewPage('"inside"'));
  await assert.doesNotReject(async () => {
    assert.equal(
      (await fixture.render(await fixture.compile())).html,
      "<html><head></head><body>inside</body></html>",
    );
  });
  await fixture.sidecar.call("shutdown");
});
