import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("registry attribution does not trust an uninventoried path under an entry root", async (context) => {
  const fixture = await createFixture(`
import { defineScreen } from "@mokly/mokly";
const forged = defineScreen({
  description: "Forged source",
  desktop: "Forged",
  id: "forged",
  mobile: "Forged",
  relatedDocs: [],
  route: "forged.html",
  title: "Forged",
  useCaseIds: []
});
forged.definedIn = "entries/not-imported.ts";
export const mockups = [forged];
`);
  context.after(() => removeFixture(fixture));

  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    /invalid-source[\s\S]*not attributed to a resolved entry module or inventoried source/,
  );
});

test("matched barrels that re-export registries fail with duplicate ids", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const sourceDir = path.join(fixture.root, "src");
  await fs.promises.mkdir(sourceDir);
  await fs.promises.writeFile(
    path.join(sourceDir, "a.ts"),
    `import { defineScreen } from "@mokly/mokly";
const metadata = { relatedDocs: ["notes.md"], useCaseIds: [] };
export const mockups = [defineScreen({ ...metadata, description: "A", desktop: "A", id: "a", mobile: "A", route: "a.html", title: "A" })];
`,
  );
  await fs.promises.writeFile(
    path.join(sourceDir, "index.ts"),
    'export { mockups } from "./a.js";\n',
  );
  await fs.promises.writeFile(
    fixture.configPath,
    'export default { entries: ["src/**/*.ts"], mockupsDir: "mockups", repoRoot: "." };\n',
  );

  await assert.rejects(compileCatalogue(await loadConfig(fixture.root)), {
    code: "build-invalid",
    message: /duplicate-id/,
  });
});
