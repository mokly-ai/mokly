import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { pageSource, pathFixture } from "./helpers/path_fixture.js";

for (const segment of ["styles", "ASSETS"])
  test(`reserved ${segment} page routes fail before consumer rendering`, async (t) => {
    const fixture = await pathFixture({ "specs/page.mockup.ts": pageSource() });
    t.after(fixture.remove);
    const probe = path.join(fixture.root, "rendered.txt");
    await fixture.write(
      "specs/page.mockup.ts",
      `
import fs from "node:fs";
import { definePage } from "@mokly/mokly";
export default definePage({ path: "${segment}/page", title: "Page", description: "Page", relatedDocs: [], render: () => {
  fs.writeFileSync(${JSON.stringify(probe)}, "rendered");
  return "<html><body>Page</body></html>";
}});`,
    );
    await assert.rejects(fixture.compile(), {
      code: "build-invalid",
      message: `[mokly/build-invalid] generated HTML route uses reserved first segment ${segment}: ${segment}/page/index.html; styles and assets are reserved for generated stylesheets and assets`,
    });
    await assert.rejects(fs.access(probe), { code: "ENOENT" });
  });
