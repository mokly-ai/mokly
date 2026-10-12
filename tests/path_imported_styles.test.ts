import assert from "node:assert/strict";
import test from "node:test";

import { pathFixture } from "./helpers/path_fixture.js";

function screen(fields = ""): string {
  return `import {defineScreen} from '@mokly/mokly';
import './theme.css';
export default defineScreen({title:'Home',description:'Home',relatedDocs:[],mobile:'Home',desktop:'Home',${fields}});`;
}

for (const directory of ["_drafts", "-drafts"])
  test(`CSS and assets preserve the derived ${directory}/home path`, async (context) => {
    const fixture = await pathFixture({
      [`specs/${directory}/home.mockup.tsx`]: screen(),
      [`specs/${directory}/theme.css`]: `main { background: url('./_assets/-image.svg') }`,
      [`specs/${directory}/_assets/-image.svg`]:
        '<svg xmlns="http://www.w3.org/2000/svg"/>',
    });
    context.after(fixture.remove);
    const compiled = await fixture.compile();
    assert.equal(compiled.manifest.entries[0]?.path, `${directory}/home`);
    const stylesheet = `styles/specs/${directory}/home.mockup.tsx.css`;
    const asset = `assets/specs/${directory}/_assets/-image.svg`;
    assert.ok(compiled.outputs.has(stylesheet));
    assert.ok(compiled.outputs.has(asset));
    assert.ok(
      String(
        compiled.outputs.get(`${directory}/home/index.mobile.html`),
      ).includes(`href="../../${stylesheet}"`),
    );
    assert.ok(
      String(compiled.outputs.get(stylesheet)).includes(`_assets/-image.svg`),
    );
  });

for (const file of [
  "Getting Started.mockup.tsx",
  "con.mockup.tsx",
  "My Dir/home.mockup.tsx",
])
  test(`a declared path cannot replace the stylesheet route for ${file}`, async (context) => {
    const directory = file.includes("/") ? "specs/My Dir" : "specs";
    const fixture = await pathFixture({
      [`specs/${file}`]: screen('path:"guides/getting-started",'),
      [`${directory}/theme.css`]: "main { color: red }",
    });
    context.after(fixture.remove);
    await assert.rejects(fixture.compile(), {
      code: "build-invalid",
      message: `[mokly/build-invalid] cannot deliver imported CSS for specs/${file}: the module path is not URL-safe; rename its file or directories (an entry path override does not change stylesheet routes)`,
    });
  });
