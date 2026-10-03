import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { DocumentService } from "../dist/server/demand/service.js";

import {
  acceptedStyles,
  compileLiveStyles,
  interactiveStylesFixture,
} from "./helpers/interactive_styles.js";

test("CSS Module aliases retain each logical path's accepted Static export map", async (t) => {
  const fixture = await interactiveStylesFixture();
  t.after(() => fixture.remove());
  const alias = path.join(fixture.entriesDir, "alias.module.css");
  await fs.symlink("card.module.css", alias);
  const source = await fs.readFile(fixture.entryPath, "utf8");
  await fs.writeFile(
    fixture.entryPath,
    `import alias from "./alias.module.css";\n${source.replace("data-module={card}", "data-module={card} data-alias={alias.card}")}`,
  );
  const runtime = await acceptedStyles(fixture.root);
  const documents = new DocumentService(runtime);
  t.after(() => documents.close());
  const html = (await documents.read("screens/home.desktop.html")).html;
  const direct = html.match(/data-module="([^"]+)"/)?.[1];
  const indirect = html.match(/data-alias="([^"]+)"/)?.[1];
  assert.ok(direct);
  assert.ok(indirect);
  assert.notEqual(direct, indirect);
  const code = await compileLiveStyles(runtime);
  assert.ok(code.includes(direct), "direct CSS Module map matches Static");
  assert.ok(code.includes(indirect), "aliased CSS Module map matches Static");
  await fs.rm(alias);
  await fs.writeFile(
    path.join(fixture.entriesDir, "card.module.css"),
    ":global() { color: red; }\n",
  );
  assert.equal(await compileLiveStyles(runtime), code);
});
