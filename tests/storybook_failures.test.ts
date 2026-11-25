import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { EntryDetailV4 } from "../packages/model/dist/index.js";
import { currentDocumentPath } from "../packages/model/src/catalogue/delivery_paths.js";
import {
  snapshotViewPath,
  viewRoute,
} from "../packages/viewer/src/navigation/routes.js";

import { consumer } from "./helpers/mokly_serve.js";
import { build, git, json, screen, write } from "./helpers/static_changes.js";
import { command } from "./helpers/static_publication.js";

function warningLines(stderr: string) {
  return stderr
    .split(/\r?\n/)
    .filter((line) => line.startsWith("[mokly/warning] "));
}

test("saved story failures write isolated documents and count in strict builds", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": JSON.stringify({
      colorSchemes: ["light", "dark"],
      stylesheets: [
        {
          match: "**",
          stylesheets: ["site.css"],
          darkStylesheets: ["dark.css"],
        },
      ],
    }),
    "site.css": "body { color: red }",
    "dark.css": "body { color: blue }",
    "specs/portal.css": "output { color: green }",
    "specs/Portal.stories.tsx": `
import { createPortal } from "react-dom";
import "./portal.css";
export default { title: "Portal example" };
export const Portal = {
  name: "Portal <Main> & Menu",
  render: () => createPortal(<p>Portal contents</p>, document.body),
};
export const Working = { render: () => <output>Still rendered</output> };
export const Cleanup = {
  name: "After markup",
  render: () => <><style>{"p { color: orange }"}</style><p>Partial result</p></>,
  beforeEach: () => () => { throw "Cleanup <failed> & stopped"; },
};
`,
  });
  const run = (extra: string[] = []) =>
    command(
      root,
      "build",
      ["--no-changes", ...extra],
      "plain",
      {},
      context.signal,
    ).result;
  const result = await run();
  assert.equal(result.code, 0, result.stderr);
  const output = path.join(root, "mokly-static");
  const warnings = [];
  for (const [entry, story, title, reason, escapedReason] of [
    [
      "Portal",
      "Portal",
      "Portal &lt;Main&gt; &amp; Menu",
      "document is not defined",
      "document is not defined",
    ],
    [
      "Portal/Cleanup",
      "Cleanup",
      "After markup",
      "Cleanup <failed> & stopped",
      "Cleanup &lt;failed&gt; &amp; stopped",
    ],
  ] as const) {
    const detail = await json<EntryDetailV4>(
      output,
      `mokly-viewer/entries/${entry}.json`,
    );
    assert.equal(detail.views.length, 4, entry);
    for (const view of detail.views) {
      const route = viewRoute(entry, view.viewport, view.colorScheme);
      warnings.push(
        `[mokly/warning] ${route}: story "specs/Portal.stories.tsx#${story}" could not render; add the "!mokly" tag to leave it out: ${reason}`,
      );
      const document = await fs.readFile(
        path.join(output, currentDocumentPath(route)),
        "utf8",
      );
      assert.match(
        document,
        new RegExp(`<html style="color-scheme: ${view.colorScheme}">`),
      );
      assert.doesNotMatch(
        document,
        /<link[^>]+rel="stylesheet"|Partial result|color: orange/u,
      );
      assert.equal(document.match(/<style\b/gu)?.length, 1, route);
      assert.match(
        document,
        /\bCanvas\b[\s\S]*\bCanvasText\b[\s\S]*\bGrayText\b/u,
      );
      assert.ok(
        document.includes(`>The ${title} story couldn’t render</p>`),
        route,
      );
      assert.ok(
        document.includes(
          "<p>Add the <code>!mokly</code> tag to this story to leave it out of the catalogue.</p>",
        ),
        route,
      );
      assert.match(document, /\bReason<\/p>/u);
      assert.ok(document.includes(`>${escapedReason}</code>`), route);
    }
  }
  assert.deepEqual(warningLines(result.stderr), warnings.sort());
  const working = await json<EntryDetailV4>(
    output,
    "mokly-viewer/entries/Portal/Working.json",
  );
  assert.equal(working.views.length, 4);
  for (const view of working.views) {
    const route = viewRoute("Portal/Working", view.viewport, view.colorScheme);
    const document = await fs.readFile(
      path.join(output, currentDocumentPath(route)),
      "utf8",
    );
    assert.match(document, /<output>Still rendered<\/output>/u);
    assert.match(document, /<link rel="stylesheet"/u);
  }

  const strict = await run(["--strict"]);
  assert.equal(strict.code, 1, strict.stderr);
  assert.deepEqual(warningLines(strict.stderr), warnings);
  assert.match(strict.stderr, /8 build warnings with --strict/u);
});

test("Changes keeps equal story failures unchanged and preserves usage lists", async (context) => {
  const dependency = fileURLToPath(import.meta.resolve("react/package.json"));
  const story = String.raw`
import path from "node:path";
import { pathToFileURL } from "node:url";
export default { title: "Story paths" };
export const Paths = {
  render() {
    const source = path.resolve(__dirname, "specs/Paths.stories.tsx");
    const sourceUrl = pathToFileURL(path.resolve(__dirname, "specs/file with spaces.txt"));
    const dependency = ${JSON.stringify(dependency)};
    const outside = path.resolve(__dirname, "../../outside-mokly/secret.txt");
    throw new Error("Source " + source + " or " + sourceUrl.href
      + "\nDependency " + dependency + " or " + pathToFileURL(dependency).href
      + "\nOutside " + outside + " or " + pathToFileURL(outside).href);
  },
};
`;
  const button = (label: string) => `---
title: Button
element: ui-button
propSchema: {type: object, additionalProperties: false, properties: {}}
---
<button>${label}</button>`;
  const root = await consumer(context, {
    ".gitignore": "node_modules/\n.context/\n",
    "mokly.config.json": JSON.stringify({
      review: { base: "fixture-base" },
      stylesheets: [{ match: "**", stylesheets: ["theme.css"] }],
    }),
    "theme.css": "body { background: white }",
    "specs/Paths.stories.tsx": story,
    "specs/button.component.html": button("Before"),
    "specs/home.screen.html": screen('<ui-button mokly-instance="button" />'),
  });
  await git(root, "init", "-q");
  await git(root, "config", "user.name", "Mokly Test");
  await git(root, "config", "user.email", "test@mokly.invalid");
  await git(root, "add", "-A");
  await git(root, "commit", "-qm", "base stories and usage");
  await git(root, "branch", "fixture-base");
  await write(
    root,
    "specs/Paths.stories.tsx",
    `${story}\n// Working source edit\n`,
  );
  await write(root, "specs/button.component.html", button("After"));
  await write(root, "theme.css", "body { background: black }");

  const built = await build(root, [], "plain", context.signal);
  assert.ok(built.index.comparisonUrl, built.stderr);
  const entry = built.index.components.find(({ path }) => path === "Paths");
  assert.ok(entry);
  assert.ok(entry.changes.status === "ready", JSON.stringify(entry.changes));
  assert.equal(entry.changes.included, false);
  for (const view of entry.views) {
    assert.deepEqual(view.comparison, {
      status: "ready",
      kind: "unmodified",
      eligible: false,
    });
  }
  const detail = await json<EntryDetailV4>(
    built.output,
    "mokly-viewer/entries/Paths.json",
  );
  const view = detail.views.find(({ viewport }) => viewport === "mobile");
  assert.ok(view);
  const snapshot = (side: "before" | "after") =>
    fs.readFile(
      path.join(
        built.output,
        built.index.comparisonUrl!,
        snapshotViewPath(side, "Paths", view.viewport, view.colorScheme),
      ),
    );
  const before = await snapshot("before");
  const after = await snapshot("after");
  assert.deepEqual(after, before);
  const reason = [
    "Source specs/Paths.stories.tsx or specs/file with spaces.txt",
    "Dependency node_modules/react/package.json or node_modules/react/package.json",
    "Outside … or …",
  ].join("\n");
  assert.ok(after.toString().includes(`>${reason}</code>`), after.toString());
  assert.deepEqual(
    warningLines(built.stderr),
    ["desktop", "mobile"].map(
      (viewport) =>
        `[mokly/warning] Paths/index.${viewport}.html: story "specs/Paths.stories.tsx#Paths" could not render; add the "!mokly" tag to leave it out: ${reason.replaceAll("\n", " ")}`,
    ),
  );
  assert.deepEqual(view.usage, {
    status: "ready",
    instances: [],
    slots: [],
    ranges: [{ id: "r-0", target: { kind: "root" } }],
  });
  const buttonDetail = await json<EntryDetailV4>(
    built.output,
    "mokly-viewer/entries/button.json",
  );
  for (const list of [
    buttonDetail.workspace?.usedBy,
    buttonDetail.workspace?.affected,
  ]) {
    assert.deepEqual(
      list?.map(({ entryPath, viewport, colorScheme, direct }) => ({
        entryPath,
        viewport,
        colorScheme,
        direct,
      })),
      [
        {
          entryPath: "home",
          viewport: "mobile",
          colorScheme: "light",
          direct: true,
        },
        {
          entryPath: "home",
          viewport: "desktop",
          colorScheme: "light",
          direct: true,
        },
      ],
    );
  }
});
