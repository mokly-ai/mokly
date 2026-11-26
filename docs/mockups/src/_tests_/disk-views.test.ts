import assert from "node:assert/strict";
import { posix } from "node:path";
import test from "node:test";

import { screenView } from "./catalogue-paths";
import type { Scheme } from "./catalogue-paths";
import {
  compareBuiltViews,
  diskSweepViews,
  generatedHtmlFiles,
  generatedViews,
} from "./disk-views";

const pair = (["light", "dark"] as const).map((scheme) => ({
  path: "fixture",
  viewport: "mobile" as const,
  scheme,
  file: screenView("fixture", "mobile", scheme),
}));
const [lightFile, darkFile] = pair.map(({ file }) => file);
const sheetPath = posix.join(posix.dirname(lightFile), "shared.css");

function fixtureDocument(scheme: Scheme, markup = ""): string {
  const light = scheme === "light";
  const ink = light ? "#123" : "white";
  const fill = light ? "rgba(0,0,0,.3)" : "hsl(180 50% 70%)";
  const mix = light ? "color-mix(in srgb, red, blue)" : "rgb(0 0 0)";
  return `<!doctype html><html style="color-scheme: ${scheme}"><head>
<link rel="stylesheet" href="shared.css">
<style>main { color: ${ink}; background-color: ${mix}; width: 100px; }</style>
</head><body><main data-color-scheme="${scheme}" style="border-color:${fill}">
<p>Fixture text</p><a data-mokly-link="fixture" href="${posix.basename(screenView("fixture", "mobile", scheme))}#target">Go</a>
<svg width="16" height="16"><path id="target" stroke="${ink}"></path></svg>
${markup}
</main></body></html>`;
}

function fixtureSweep(
  dark: string,
  css = "main { padding: 2px; }",
  light = fixtureDocument("light"),
) {
  const files = new Map([
    [lightFile, light],
    [darkFile, dark],
    [sheetPath, css],
  ]);
  return diskSweepViews(
    pair,
    compareBuiltViews(pair, (path) => files.get(path)),
  ).map(({ file }) => file);
}

test("light covers a dark document with the same layout and resources", () => {
  const css =
    ":root { --mk-color-extra: #000; }" +
    '[data-color-scheme="dark"] { --mk-color-extra: #fff; }' +
    "main { border: 30px solid var(--mk-color-extra); }";
  assert.deepEqual(fixtureSweep(fixtureDocument("dark"), css), [lightFile]);
});

test("dark still runs when its layout or resources can differ", () => {
  const dark = fixtureDocument("dark");
  const border = "main { border: 30px solid var(--mk-color-extra); }";
  const darkResources = [
    [
      "dark picture source",
      '<picture><source media="(prefers-color-scheme: dark)" srcset="wide.svg"><img src="narrow.svg" alt="Example"></picture>',
    ],
    [
      "dark image sizes",
      '<img srcset="narrow.svg 128w, wide.svg 708w" sizes="(prefers-color-scheme: dark) 708px, 128px" alt="Example">',
    ],
    [
      "dark preload link",
      '<link rel="preload" as="image" href="wide.svg" media="(prefers-color-scheme: dark)">',
    ],
  ] as const;
  const cases = [
    ["display", dark.replace("width: 100px", "display: none; width: 100px")],
    ["width", dark.replace("width: 100px", "width: 200px")],
    ["removed element", dark.replace("<p>Fixture text</p>", "")],
    ["changed text", dark.replace("Fixture text", "Changed text")],
    ["malformed paint", dark.replace("white", "rgb(invalid)")],
    [
      "wrong linked view",
      dark.replace("index.mobile.dark.html#target", "index.mobile.html#target"),
    ],
    [
      "unknown stylesheet",
      dark.replace("shared.css", "https://example.test/style.css"),
    ],
    [
      "theme selector",
      dark,
      '[data-color-scheme="dark"] main { display: none; }',
    ],
    [
      "theme media query",
      dark,
      "@media (prefers-color-scheme: dark) { main { width: 200px; } }",
    ],
    [
      "custom property in a dark selector",
      dark,
      border + '[data-color-scheme="dark"] { --mk-color-extra: #fff; }',
    ],
    [
      "custom property in a dark media query",
      dark,
      border +
        "@media (prefers-color-scheme: dark) { main { --mk-color-extra: #fff; } }",
    ],
    ...darkResources.map(
      ([name, markup]) =>
        [
          name,
          fixtureDocument("dark", markup),
          undefined,
          fixtureDocument("light", markup),
        ] as const,
    ),
    [
      "style query",
      dark,
      "@container style(--ink: red) { main { display: none; } }",
    ],
    ["stylesheet import", dark, '@import "other.css";'],
  ] as const;
  assert.deepEqual(
    cases.map(([name, document, css, light]) => ({
      name,
      files: fixtureSweep(document, css, light),
    })),
    cases.map(([name]) => ({ name, files: [lightFile, darkFile] })),
  );
});

test("an empty index record still requires both widths and themes", () => {
  const { views, missingIndexViews } = generatedViews({
    screens: [],
    components: [{ path: "fixture", views: [] }],
  });
  const files = [
    screenView("fixture", "mobile", "light"),
    screenView("fixture", "mobile", "dark"),
    screenView("fixture", "desktop", "light"),
    screenView("fixture", "desktop", "dark"),
  ];
  assert.deepEqual(
    { files: views.map(({ file }) => file), missingIndexViews },
    { files, missingIndexViews: files },
  );
});

test("every built view left out of the disk sweep matches its light view", () => {
  const { views, missingIndexViews } = generatedViews();
  assert.deepEqual(
    missingIndexViews,
    [],
    "the catalogue index omits required views",
  );
  const files = new Set(generatedHtmlFiles());
  assert.deepEqual(
    views.map(({ file }) => file).filter((file) => !files.has(file)),
    [],
    "the build omits required documents",
  );
  const byFile = new Map(views.map((view) => [view.file, view]));
  const compare = compareBuiltViews(views);
  const swept = new Set(diskSweepViews(views, compare).map(({ file }) => file));
  const uncovered = views.filter((view) => {
    if (swept.has(view.file)) return false;
    const light = byFile.get(screenView(view.path, view.viewport));
    return (
      view.scheme !== "dark" || light === undefined || !compare(light, view)
    );
  });
  assert.deepEqual(
    uncovered.map(({ file }) => file),
    [],
  );
});
