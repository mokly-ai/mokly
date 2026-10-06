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
  ["relative static path", 'await page.goto("/static/design/example.html");'],
  ["home path", 'await page.goto("/");'],
  ["relative template", "await page.goto(`/static/${entry}/index.html`);"],
  ["literal variable", 'const url = "/"; await page.goto(url);'],
  [
    "reassigned artboard URL",
    'let url = designArtboardUrl("design/components/overview", "mobile"); url = "/"; await page.goto(url);',
  ],
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
  [
    "joined raw path",
    'const file = path.join(repositoryRoot, "examples/basic/generated", "design/browse/views/home/index.mobile.html");',
  ],
  [
    "resolved raw path",
    'const file = path.resolve(repositoryRoot, "examples/basic/generated", "design/browse/views/home/index.mobile.html");',
  ],
  [
    "split raw segments",
    'const file = path.join(repositoryRoot, "examples/basic", "generated", "design", "browse/views/home/index.mobile.html");',
  ],
  [
    "generated template",
    "const file = `${generated}/design/browse/views/home/index.mobile.html`;",
  ],
  [
    "assigned generated template",
    'const output = "examples/basic/generated"; const file = `${output}/design/browse/views/home/index.mobile.html`;',
  ],
  [
    "design file URL call",
    'pathToFileURL(path.join(root, "design/browse/views/home/index.mobile.html"));',
  ],
  [
    "design file URL variable",
    'const file = path.join(root, "design/browse/views/home/index.mobile.html"); pathToFileURL(file);',
  ],
  [
    "design file URL string",
    'const url = "file:///tmp/design/browse/views/home/index.mobile.html";',
  ],
  [
    "design file URL template",
    "const url = `file://${root}/design/browse/views/home/index.mobile.html`;",
  ],
  [
    "aliased file URL call",
    'import { pathToFileURL as toFileUrl } from "node:url"; toFileUrl(path.join(root, "design/browse/views/home/index.mobile.html"));',
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
        path: "tests/browser/design/url_helper.ts",
        source:
          'import { designArtboardUrl as artboard } from "./artboards.js"; const url = artboard("design/components/overview", "mobile"); await page.goto(url);',
      },
      {
        path: "tests/browser/sample.spec.ts",
        source:
          'await page.goto("/view/example/screens/welcome/"); await exportCatalogue(config);',
      },
      {
        path: "tests/browser/design/assigned_url.ts",
        source:
          'const url = designArtboardUrl("design/components/overview", "mobile"); const destination = url; await page.goto(destination);',
      },
    ]),
    [],
  );
});

test("served design routes and route markers remain runtime content", () => {
  assert.deepEqual(
    designBoundaryIssues([
      {
        path: "tests/browser/routes.ts",
        source: `
    await page.goto("/view/design/components/overview/");
    await page.goto(\`/view/design/\${entry}/\`);
    const row = 'data-route="design/components/overview/index.html"';
    await page.route("**/design/**", handler);
  `,
      },
    ]),
    [],
  );
});

test("helper modules have the same boundaries as browser specs", () => {
  assert.deepEqual(
    designBoundaryIssues([
      {
        path: "tests/browser/component_design_fixture.ts",
        source:
          'pathToFileURL(path.join(root, "generated", "design/browse/home/index.mobile.html"));',
      },
      {
        path: "tests/browser/design/artboards.ts",
        source: 'await page.goto("/");',
      },
    ]),
    [
      {
        path: "tests/browser/component_design_fixture.ts",
        rule: "runtime-artboard",
      },
      { path: "tests/browser/design/artboards.ts", rule: "design-runtime" },
    ],
  );
});

test("the real browser tree keeps design and runtime test layers separate", async () => {
  const directory = path.join(repositoryRoot, "tests/browser");
  const files = await fs.readdir(directory, { recursive: true });
  const specs: BrowserSpecSource[] = await Promise.all(
    files
      .filter((file) => file.endsWith(".ts"))
      .sort()
      .map(async (file) => ({
        path: `tests/browser/${file.replaceAll("\\", "/")}`,
        source: await fs.readFile(path.join(directory, file), "utf8"),
      })),
  );
  assert.deepEqual(designBoundaryIssues(specs), []);
});
