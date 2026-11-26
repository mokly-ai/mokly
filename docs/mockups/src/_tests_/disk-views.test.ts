import assert from "node:assert/strict";
import { posix } from "node:path";
import test from "node:test";

import { screenView } from "./catalogue-paths";
import type { Scheme } from "./catalogue-paths";
import {
  compareBuiltViews,
  diskSweepViews,
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

function fixtureDocument(scheme: Scheme): string {
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
</main></body></html>`;
}

function fixtureSweep(dark: string, css = "main { padding: 2px; }") {
  const files = new Map([
    [lightFile, fixtureDocument("light")],
    [darkFile, dark],
    [sheetPath, css],
  ]);
  return diskSweepViews(
    pair,
    compareBuiltViews(pair, (path) => files.get(path)),
  ).map(({ file }) => file);
}

test("light covers a dark document with the same layout and resources", () => {
  assert.deepEqual(fixtureSweep(fixtureDocument("dark")), [lightFile]);
});

test("dark still runs when its layout or resources can differ", () => {
  const dark = fixtureDocument("dark");
  for (const [change, document, css] of [
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
      "style query",
      dark,
      "@container style(--ink: red) { main { display: none; } }",
    ],
    ["stylesheet import", dark, '@import "other.css";'],
  ] as const)
    assert.deepEqual(
      fixtureSweep(document, css),
      [lightFile, darkFile],
      change,
    );
});

test("every built view left out of the disk sweep matches its light view", () => {
  const views = generatedViews();
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
