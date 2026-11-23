import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { EntryDetailV4 } from "../packages/model/dist/index.js";

import { consumer, serve } from "./helpers/mokly_serve.js";
import { build, git, json, write } from "./helpers/static_changes.js";
import { files } from "./helpers/static_faults.js";
import { command, publicationFixture } from "./helpers/static_publication.js";

const component = `
import React from "react";
import {defineComponent} from "@mokly/mokly";
import png from "../media/logo.png";
import svg from "../media/logo.svg";
export default defineComponent({
  path: "gallery", element: "ui-gallery", title: "Gallery", description: "", relatedDocs: [],
  propSchema: {type: "object", additionalProperties: false, properties: {}}, props: {},
  render: () => React.createElement("div", {className: "gallery"},
    React.createElement("img", {src: png, alt: "PNG"}),
    React.createElement("img", {src: svg, alt: "SVG"})),
});`;

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGMwy9xBEmIY1TCqYfhqAADXxFcQLx0+cgAAAABJRU5ErkJggg==",
  "base64",
);
const editedPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGNQ7sggCTGMahjVMHw1AADurBMQHiV3egAAAABJRU5ErkJggg==",
  "base64",
);
const svg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="orange"/></svg>',
);
const generated = "static/mokly-generated";
const documentRoute = `${generated}/gallery/index.mobile.html`;
const assets = [
  ["media/logo.png", png, "image/png"],
  ["media/logo.svg", svg, "image/svg+xml"],
] as const;

async function writeAssets(root: string) {
  await fs.mkdir(path.join(root, "media"));
  for (const [file, bytes] of assets)
    await fs.writeFile(path.join(root, file), bytes);
}

function checkDocument(html: string) {
  assert.match(html, /src="\.\.\/assets\/media\/logo\.png"/u);
  assert.match(html, /src="\.\.\/assets\/media\/logo\.svg"/u);
  assert.doesNotMatch(html, /mokly-asset:/u);
}

test(
  "build and Serve deliver component images and share the stylesheet asset route",
  { timeout: 60_000 },
  async (context) => {
    const root = await consumer(context, {
      "mokly.config.json": JSON.stringify({
        stylesheets: [{ match: "**", stylesheets: ["theme.css"] }],
      }),
      "specs/home.mockup.ts": component,
      "theme.css": '.gallery { background: url("./media/logo.png") }',
    });
    await writeAssets(root);
    const result = await command(root, "build", [
      "--no-changes",
      "--out=.context/site",
      "--sidecars=1",
    ]).result;
    assert.equal(result.code, 0, result.stderr);
    const output = await files(path.join(root, ".context/site"));
    checkDocument(output.get(documentRoute)?.toString() ?? "");
    for (const [file, bytes] of assets)
      assert.deepEqual(output.get(`${generated}/assets/${file}`), bytes, file);
    const pngRoute = `${generated}/assets/media/logo.png`;
    assert.deepEqual(
      [...output.keys()].filter((file) => file.endsWith("/logo.png")),
      [pngRoute],
    );
    const cssRoutes = new Set<string>();
    for (const [file, bytes] of output) {
      if (!file.startsWith(`${generated}/styles/`)) continue;
      for (const [, reference] of bytes
        .toString()
        .matchAll(/url\(["']?([^"')]+)["']?\)/gu))
        cssRoutes.add(path.posix.join(path.posix.dirname(file), reference!));
    }
    assert.deepEqual([...cssRoutes], [pngRoute]);

    const running = await serve(context, root);
    const url = await running.ready();
    const request = (route: string) =>
      fetch(`${url}/${route}`, { signal: running.signal });
    const document = await request(documentRoute);
    assert.equal(document.status, 200);
    checkDocument(await document.text());
    for (const [file, bytes, contentType] of assets) {
      const image = await request(`${generated}/assets/${file}`);
      assert.equal(image.status, 200, file);
      assert.equal(image.headers.get("content-type"), contentType, file);
      assert.deepEqual(Buffer.from(await image.arrayBuffer()), bytes, file);
    }
    await running.close();
  },
);

test(
  "Serve delivers a file-loaded .txt asset as UTF-8 text",
  { timeout: 60_000 },
  async (context) => {
    const notes = "Café notes\n";
    const root = await consumer(context, {
      "mokly.config.json": JSON.stringify({
        moduleResolution: { loaders: { ".txt": "file" } },
      }),
      "media/notes.txt": notes,
      "specs/home.mockup.ts": `
import React from "react";
import {defineComponent} from "@mokly/mokly";
import notes from "../media/notes.txt";
export default defineComponent({
  path: "gallery", element: "ui-gallery", title: "Gallery", description: "", relatedDocs: [],
  propSchema: {type: "object", additionalProperties: false, properties: {}}, props: {},
  render: () => React.createElement("a", {href: notes}, "Notes"),
});`,
    });
    const running = await serve(context, root);
    const ready = running.ready();
    await assert.doesNotReject(ready);
    const url = await ready;
    const response = await fetch(`${url}/${generated}/assets/media/notes.txt`, {
      signal: running.signal,
    });
    assert.equal(response.status, 200, running.output.stderr);
    assert.equal(
      response.headers.get("content-type"),
      "text/plain; charset=utf-8",
    );
    assert.deepEqual(
      Buffer.from(await response.arrayBuffer()),
      Buffer.from(notes),
    );
    await running.close();
  },
);

test(
  "a PNG-only edit lists the component view in Changes and preserves the base bytes",
  { timeout: 60_000 },
  async (context) => {
    const root = await publicationFixture(true);
    context.after(() => fs.rm(root, { recursive: true, force: true }));
    await write(
      root,
      "mokly.config.json",
      '{"review":{"base":"fixture-base"}}',
    );
    await write(root, "specs/home.mockup.ts", component);
    await writeAssets(root);
    await git(root, "add", "-A");
    await git(root, "commit", "-qm", "base images");
    await git(root, "branch", "fixture-base");
    await fs.writeFile(path.join(root, "media/logo.png"), editedPng);

    const built = await build(root, ["--sidecars=1"]);
    assert.equal(built.index.changesStatus, "ready", built.stderr);
    assert.deepEqual(
      built.index.components.find(({ path }) => path === "gallery")?.changes,
      { status: "ready", kind: "changed", included: true },
    );
    const detail = await json<EntryDetailV4>(
      built.output,
      "mokly-viewer/entries/gallery.json",
    );
    assert.equal(
      detail.views.find(({ viewport }) => viewport === "mobile")?.state,
      "changed",
    );
    const prefix = built.index.comparisonUrl;
    assert.equal(typeof prefix, "string");
    for (const [side, bytes] of [
      ["before", png],
      ["after", editedPng],
    ] as const) {
      const route = `${prefix}snapshots/${side}/mokly-generated/assets/media/logo.png`;
      assert.deepEqual(
        await fs.readFile(path.join(built.output, route)),
        bytes,
      );
    }
  },
);

test(
  "a non-portable asset import names its first logical importer in the build error",
  { timeout: 60_000 },
  async (context) => {
    const root = await consumer(context, {
      "specs/home.mockup.ts": component
        .replace("../media/logo.png", "./z-import.mjs")
        .replace("../media/logo.svg", "./a-import.mjs"),
      "specs/z-import.mjs": 'export {default} from "../media/bad name.png";',
      "specs/a-import.mjs": 'export {default} from "../media/bad name.png";',
    });
    await fs.mkdir(path.join(root, "media"));
    await fs.writeFile(path.join(root, "media/bad name.png"), png);
    const failed = await command(
      root,
      "build",
      ["--no-changes", "--out=.context/site", "--sidecars=1"],
      "plain",
    ).result;
    assert.equal(failed.code, 1, failed.stderr);
    assert.equal(
      failed.stderr.trim(),
      "[mokly/build-invalid] asset route is not portable: media/bad name.png, imported by specs/a-import.mjs; rename every path segment to be URL-safe (letters, digits, dot, underscore, tilde or hyphen; @scope only after node_modules; no spaces or device names)",
    );
  },
);
