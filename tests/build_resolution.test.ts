import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("consumer module resolution supports package roots, aliases, and web conditions", async (context) => {
  const fixture = await createFixture(`
import { defineScreen } from "@mokly/mokly";
import React from "react";
import { FixturePanel } from "fixture-ui";
const metadata = { relatedDocs: [], useCaseIds: [] };
export const mockups = [defineScreen({
  ...metadata,
  description: "Consumer resolution fixture",
  desktop: <FixturePanel />,
  id: "consumer-resolution",
  mobile: <FixturePanel />,
  route: "screens/consumer-resolution.html",
  title: "Consumer resolution"
})];
`);
  context.after(() => removeFixture(fixture));
  const packageRoot = path.join(fixture.root, "packages", "runtime");
  const modules = path.join(packageRoot, "node_modules");
  await fs.promises.mkdir(path.join(modules, "fixture-ui"), {
    recursive: true,
  });
  await fs.promises.mkdir(path.join(modules, "fixture-web"), {
    recursive: true,
  });
  await fs.promises.writeFile(
    path.join(packageRoot, "package.json"),
    '{"name":"fixture-runtime","private":true}\n',
  );
  await fs.promises.writeFile(
    path.join(modules, "fixture-ui", "package.json"),
    '{"name":"fixture-ui","type":"module","exports":"./index.js"}\n',
  );
  await fs.promises.writeFile(
    path.join(modules, "fixture-ui", "index.js"),
    'import React from "react"; import { platform } from "fixture-native"; export const FixturePanel = () => React.createElement("main", { "data-platform": platform });\n',
  );
  await fs.promises.writeFile(
    path.join(modules, "fixture-web", "package.json"),
    '{"name":"fixture-web","type":"module","exports":"./index.js"}\n',
  );
  await fs.promises.writeFile(
    path.join(modules, "fixture-web", "index.js"),
    'export const platform = "web";\n',
  );
  await fs.promises.writeFile(
    fixture.configPath,
    `export default {
  entriesDir: "entries",
  mockupsDir: "mockups",
  moduleResolution: {
    aliases: { "fixture-native": "fixture-web" },
    conditions: ["browser", "import", "default"],
    loaders: { ".js": "jsx" },
    mainFields: ["browser", "module", "main"],
    packageRoots: ["packages/runtime"],
    resolveExtensions: [".web.tsx", ".tsx", ".ts", ".js"]
  },
  repoRoot: "."
};\n`,
  );

  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);

  assert.match(
    compilation.outputs.get("screens/consumer-resolution.desktop.html") ?? "",
    /data-platform="web"/,
  );
});
