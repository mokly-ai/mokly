import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { runtimeGraph } from "../dist/build/component_runtime.js";
import { DocumentCompiler } from "../dist/build/document_compiler.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import {
  compileFixture,
  entryStyle,
  styleFixture,
} from "./helpers/imported_styles_fixture.js";

const contexts = [
  ["background", 'background:url("./background.png")'],
  ["image-set", 'background:image-set(url("./image-set.png") 1x)'],
  [
    "webkit-image-set",
    'background:-webkit-image-set(url("./webkit-image-set.png") 1x)',
  ],
  ["cursor", 'cursor:url("./cursor.png"),auto'],
  ["mask", 'mask:url("./mask.png")'],
] as const;

for (const module of [false, true]) {
  test(`${module ? "module" : "plain"} CSS delivers url() assets in every context`, async (context) => {
    const css = `${contexts.map(([name, declaration]) => `.${name.replaceAll("-", "_")}{${declaration}}`).join("\n")}\n@font-face{src:url("./font.woff")}`;
    const fixture = await styleFixture(css, { module });
    context.after(() => removeFixture(fixture));
    const assets = [...contexts.map(([name]) => `${name}.png`), "font.woff"];
    for (const name of assets)
      await fs.writeFile(
        path.join(fixture.entriesDir, name),
        Buffer.from([0, 255, 17]),
      );
    const compiled = await compileFixture(fixture);
    const stylesheet = compiled.outputs.get(entryStyle) as string;
    assert.equal(typeof stylesheet, "string");
    for (const name of assets) {
      assert.deepEqual(
        Buffer.from(
          compiled.outputs.get(
            `mokly-generated/assets/entries/${name}`,
          ) as Uint8Array,
        ),
        Buffer.from([0, 255, 17]),
        name,
      );
      assert.match(
        stylesheet,
        new RegExp(`assets/entries/${name.replace(".", "\\.")}`),
      );
    }
  });
}

test("an unrelated on-demand view is valid when another entry uses module image-set assets", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "hero.module.css"),
    '.hero{background:image-set(url("./hero.png") 1x)}',
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "hero.png"),
    Buffer.from([0, 1, 255]),
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "other.mockup.ts"),
    'import classes from "./hero.module.css"; export const mockups = classes.hero ? [] : undefined;',
  );
  const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
  assert.ok(
    runtime.styleOutputs.some(([route]) =>
      route.endsWith("other.mockup.ts.css"),
    ),
  );
  assert.match(
    new DocumentCompiler(runtime, runtimeGraph(runtime)).render(
      "screens/home.mobile.html",
    ).html,
    /home/i,
  );
});
