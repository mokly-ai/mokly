import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  designBoundaryIssues,
  type BrowserSpecSource,
} from "./helpers/design_test_boundaries.js";
import { repositoryRoot } from "./helpers/fixture.js";

for (const [label, source] of [
  ["served shell", 'await page.goto("/view/design/browse/views/home/");'],
  ["absolute shell", 'await page.goto("http://localhost/view/home/");'],
  ["fixture server", "await page.goto(`${server.url}/view/home/`);"],
  ["export", "await exportCatalogue(config, { outDir: 'site' });"],
  ["preview", "await buildPreview(config, output);"],
  ["server", "await startCatalogueServer(config, { port: 0 });"],
  [
    "aliased export",
    'import { exportCatalogue as publish } from "../../dist/export/run.js"; await publish(config);',
  ],
  [
    "runtime helper",
    'import { servePreviewFixture } from "../preview_fixture.js";',
  ],
] as const)
  test(`raw-artboard specs reject ${label}`, () => {
    assert.deepEqual(
      designBoundaryIssues([
        { path: "tests/browser/design/sample.spec.ts", source },
      ]),
      [{ path: "tests/browser/design/sample.spec.ts", rule: "design-runtime" }],
    );
  });

for (const [label, source] of [
  [
    "artboard helper",
    'import { designArtboardUrl } from "./design/artboards.js";',
  ],
  [
    "aliased helper",
    'import { designArtboardUrl as open } from "./design/artboards.js";',
  ],
  ["namespace helper", 'import * as artboards from "./design/artboards.js";'],
  [
    "raw design path",
    'const file = "examples/basic/generated/design/browse/views/home/index.mobile.html";',
  ],
] as const)
  test(`runtime specs reject ${label}`, () => {
    assert.deepEqual(
      designBoundaryIssues([{ path: "tests/browser/sample.spec.ts", source }]),
      [{ path: "tests/browser/sample.spec.ts", rule: "runtime-artboard" }],
    );
  });

test("the boundary accepts raw artboards and non-design runtime fixtures", () => {
  assert.deepEqual(
    designBoundaryIssues([
      {
        path: "tests/browser/design/sample.spec.ts",
        source:
          'import { designArtboardUrl } from "./artboards.js"; await page.goto(designArtboardUrl("design/components/overview", "mobile"));',
      },
      {
        path: "tests/browser/sample.spec.ts",
        source:
          'await page.goto("/view/example/screens/welcome/"); await exportCatalogue(config);',
      },
    ]),
    [],
  );
});

test("the real browser tree keeps design and runtime test layers separate", async () => {
  const directory = path.join(repositoryRoot, "tests/browser");
  const files = await fs.readdir(directory, { recursive: true });
  const specs: BrowserSpecSource[] = await Promise.all(
    files
      .filter((file) => file.endsWith(".spec.ts"))
      .sort()
      .map(async (file) => ({
        path: `tests/browser/${file.replaceAll("\\", "/")}`,
        source: await fs.readFile(path.join(directory, file), "utf8"),
      })),
  );
  assert.deepEqual(designBoundaryIssues(specs), []);
});
