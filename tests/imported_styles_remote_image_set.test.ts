import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import {
  compileFixture,
  styleFixture,
} from "./helpers/imported_styles_fixture.js";

for (const url of [
  "data:image/png;base64,iVBORw0KGgo=",
  "https://cdn.example.test/a.png",
  "http://cdn.example.test/a.png",
  "//cdn.example.test/a.png",
]) {
  test(`quoted external image-set ${url} stays external in imported and public CSS`, async (context) => {
    const imported = await styleFixture(
      `.hero{background:image-set("${url}" 1x)}`,
    );
    context.after(() => removeFixture(imported));
    const compiled = await compileFixture(imported);
    assert.ok(
      [...compiled.outputs.values()].some(
        (content) => typeof content === "string" && content.includes(url),
      ),
    );
    assert.ok(
      ![...compiled.outputs.keys()].some((route) =>
        route.startsWith("mokly-generated/assets/"),
      ),
    );

    const publicFixture = await createFixture(undefined, {
      extraConfig:
        'stylesheets: [{ match: "**", stylesheets: ["public.css"] }],',
    });
    context.after(() => removeFixture(publicFixture));
    await fs.writeFile(
      path.join(publicFixture.mockupsDir, "public.css"),
      `.hero{background:image-set("${url}" 1x)}`,
    );
    await assert.doesNotReject(
      compileCatalogue(await loadConfig(publicFixture.root)),
    );
  });
}
