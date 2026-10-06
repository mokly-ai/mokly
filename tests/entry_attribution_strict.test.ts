import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../packages/mokly/dist/build/compile.js";
import { loadConfig } from "../packages/mokly/dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("registry attribution does not trust an uninventoried path under an entry root", async (context) => {
  const fixture = await createFixture(`
import { defineScreen } from "@mokly/mokly";
const forged = defineScreen({
  dependencies: [],
  description: "Forged source",
  desktop: "Forged",
  path: "forged",
  mobile: "Forged",
  relatedDocs: [],
  route: "forged.html",
  title: "Forged",
  useCasePaths: []
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
const metadata = { dependencies: ["notes.md"], relatedDocs: ["notes.md"], useCasePaths: [] };
export const mockups = [defineScreen({ ...metadata, description: "A", desktop: "A", path: "a", mobile: "A",  title: "A" })];
`,
  );
  await fs.promises.writeFile(
    path.join(sourceDir, "index.ts"),
    'export { mockups } from "./a.js";\n',
  );
  await fs.promises.writeFile(
    fixture.configPath,
    'export default { roots: [{ dir: "src", files: ["**/*.ts"] }], mockupsDir: "mockups", repoRoot: "." };\n',
  );

  await assert.rejects(compileCatalogue(await loadConfig(fixture.root)), {
    code: "build-invalid",
    message: /duplicate-export/,
  });
});
