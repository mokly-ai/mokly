import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { writeCompilation } from "../dist/build/transaction.js";
import { isPublicStaticFile } from "../dist/config/public_files.js";
import { exportCatalogue } from "../dist/export/run.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { pathFixture } from "./helpers/path_fixture.js";

for (const route of ["mokly-manifest.json", "other/index.html", "a.png"])
  test(`Markdown rejects a link to owned output before it enters sourceFiles: ${route}`, async (t) => {
    const fixture = await pathFixture({
      "specs/guide.md": "# Guide",
      "specs/other.md": "# Other\n\n![Image](a.png)",
      "specs/a.png": "image",
    });
    t.after(fixture.remove);
    const config = await fixture.config();
    await writeCompilation(await fixture.compile(), config);
    const destination = `../generated/${route}`;
    await fixture.write(
      "specs/guide.md",
      `# Guide\n\n[Output](${destination})`,
    );
    await assert.rejects(fixture.compile(), {
      code: "build-invalid",
      detail: `specs/guide.md: link target ${destination} targets Mokly-owned output or metadata`,
    });
  });

test("public stylesheet and ordinary-file links remain public through repeated Build and export", async (t) => {
  const fixture = await pathFixture(
    {
      "specs/guide.md":
        "# Guide\n\n[Styles](../generated/theme.css)\n\n[Notes](../generated/notes.txt)\n\n![Public picture](../generated/public.png)",
      "specs/screen.mockup.tsx":
        "import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'Screen',description:'A screen',dependencies:[],relatedDocs:[],mobile:<h1>Mobile</h1>,desktop:<h1>Desktop</h1>});",
      "generated/theme.css": "h1{color:green}",
      "generated/notes.txt": "Public notes",
      "generated/public.png": "public image",
    },
    '{mockupsDir:"generated",roots:[{dir:"specs"}],stylesheets:[{match:"**/*.html",stylesheets:["theme.css"]}]}',
  );
  t.after(fixture.remove);
  const config = await fixture.config();
  for (let pass = 0; pass < 2; pass++) {
    const compilation = await fixture.compile();
    for (const file of ["theme.css", "notes.txt", "public.png"]) {
      assert.ok(
        !compilation.manifest.sourceFiles.includes(`generated/${file}`),
      );
      assert.equal(
        isPublicStaticFile(path.join(fixture.root, "generated", file), {
          ...config,
          sourceFiles: compilation.manifest.sourceFiles,
        }),
        true,
      );
    }
    const html = compilation.outputs.get("guide/index.html") as string;
    assert.ok(html.includes("<p>Styles</p>"));
    assert.ok(html.includes("<p>Notes</p>"));
    assert.ok(html.includes("<p>Public picture</p>"));
    await writeCompilation(compilation, config);
  }
  const server = await startCatalogueServer(config, {
    base: "HEAD",
    port: 0,
    changesStatus: "unavailable",
  });
  try {
    assert.equal(
      await (await fetch(`${server.url}/static/notes.txt`)).text(),
      "Public notes",
    );
    assert.equal(
      await (await fetch(`${server.url}/static/theme.css`)).text(),
      "h1{color:green}",
    );
  } finally {
    await server.close();
  }
  await exportCatalogue(config, { outDir: "site", noChanges: true });
  assert.equal(
    await fs.readFile(path.join(fixture.root, "site/static/notes.txt"), "utf8"),
    "Public notes",
  );
  assert.equal(
    await fs.readFile(path.join(fixture.root, "site/static/theme.css"), "utf8"),
    "h1{color:green}",
  );
});
