import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { files } from "./helpers/static_faults.js";
import { command, publicationFixture } from "./helpers/static_publication.js";

async function write(root: string, name: string, bytes: string | Uint8Array) {
  const file = path.join(root, name);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes);
}
async function built(root: string) {
  const result = await command(root, "build", [
    "--no-changes",
    "--out=.context/site",
  ]).result;
  assert.equal(result.code, 0, result.stderr);
  return files(path.join(root, ".context/site"));
}
function protectedResource(name: string, reason: string) {
  return ["desktop", "mobile"]
    .map(
      (viewport) =>
        `[mokly/build-invalid] document links and resources are invalid:\\u000a- home/index.${viewport}.html: protected target ../../${name}: ${reason}\n`,
    )
    .join("");
}
test(
  "static closure keeps generated private-directory assets and external CSS URLs without stray files",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture();
    try {
      await write(
        root,
        "mokly.config.json",
        JSON.stringify({
          stylesheets: [{ match: "**", stylesheets: ["theme.css"] }],
        }),
      );
      const assets = [
        "node_modules/leaflet/dist/a.png",
        "target/b.woff",
        "node_modules/@fontsource/demo/files/font.woff2",
      ];
      for (const [index, name] of assets.entries())
        await write(root, name, Buffer.from([0, 255, index]));
      await write(
        root,
        "theme.css",
        assets
          .map((name, index) => `.image-${index}{background:url("./${name}")}`)
          .join("\n") + '.external{background:url("//cdn.example.test/a.png")}',
      );
      await write(root, "mokly-generated/styles/stray.css", ".stray{}");
      const output = await built(root);
      for (const [index, name] of assets.entries()) {
        const entry = [...output].find(
          ([file]) =>
            file.startsWith("static/mokly-generated/assets/") &&
            file.endsWith(name),
        );
        assert.ok(entry, name);
        assert.deepEqual(entry[1], Buffer.from([0, 255, index]));
      }
      assert.ok(
        [...output].some(
          ([name, bytes]) =>
            name.endsWith(".css") &&
            bytes.toString().includes("//cdn.example.test/a.png"),
        ),
      );
      assert.ok(!output.has("static/theme.css"));
      assert.ok(
        ![...output.keys()].some(
          (name) =>
            name.includes("stray.css") || name.endsWith("home.screen.html"),
        ),
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
test(
  "imported and unused HTML templates remain private while their registered page is published",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture(true);
    try {
      await write(
        root,
        "mokly.config.json",
        JSON.stringify({ moduleResolution: { loaders: { ".html": "text" } } }),
      );
      await write(
        root,
        "specs/template.html",
        "<!doctype html><html><head><title>Home</title></head><body><h1>Private template content</h1></body></html>",
      );
      await write(root, "specs/unused.source.html", "unused private template");
      await write(
        root,
        "specs/home.mockup.ts",
        "import {definePage} from '@mokly/mokly'; import template from './template.html'; export default definePage({title:'Home',description:'',relatedDocs:[],render:()=>template});",
      );
      const output = await built(root);
      assert.ok(
        [...output].some(
          ([name, bytes]) =>
            name.startsWith("static/mokly-generated/home/") &&
            bytes.toString().includes("Private template content"),
        ),
      );
      assert.ok(
        ![...output.keys()].some((name) =>
          /template\.html|unused\.source\.html|home\.mockup\.ts$/u.test(name),
        ),
      );
      await write(root, "specs/home.mockup.ts", "export const invalid = ;");
      const failed = await command(root, "build", [
        "--no-changes",
        "--out=.context/site",
      ]).result;
      assert.equal(failed.code, 1);
      assert.match(failed.stderr, /Unexpected/u);
      assert.deepEqual(await files(path.join(root, ".context/site")), output);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
test(
  "public closure rejects private folders and package payloads while keeping the last output",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture();
    try {
      const previous = await built(root);
      for (const [name, roots, reason] of [
        ["assets/node_modules/private.svg", [], "consumer dependency tree"],
        ["styles/node_modules/private.css", [], "consumer dependency tree"],
        [
          "consumer-package/theme.css",
          ["consumer-package"],
          "private package or output tree",
        ],
        ["specs/private.svg", ["specs"], "private package or output tree"],
      ] as const) {
        await write(
          root,
          name,
          name.endsWith(".css") ? "body{color:red}" : "<svg/>",
        );
        for (const pkg of roots)
          await write(
            root,
            `${pkg}/package.json`,
            '{"name":"private-package"}',
          );
        await write(
          root,
          "mokly.config.json",
          JSON.stringify({ moduleResolution: { packageRoots: [...roots] } }),
        );
        const element = name.endsWith(".css")
          ? `<link rel="stylesheet" href="../../${name}">`
          : `<img src="../../${name}">`;
        await write(
          root,
          "specs/home.screen.html",
          `---\ntitle: Home\n---\n${element}`,
        );
        const result = await command(root, "build", [
          "--no-changes",
          "--out=.context/site",
        ]).result;
        assert.equal(result.code, 1, name);
        assert.equal(result.stderr, protectedResource(name, reason));
        assert.deepEqual(
          await files(path.join(root, ".context/site")),
          previous,
        );
      }
      await write(root, "package.json", '{"name":"consumer"}');
      await write(root, "logo.svg", "<svg/>");
      await write(
        root,
        "mokly.config.json",
        JSON.stringify({
          moduleResolution: { packageRoots: [".", "consumer-package"] },
        }),
      );
      await write(
        root,
        "specs/home.screen.html",
        '---\ntitle: Home\n---\n<img src="../../logo.svg">',
      );
      const output = await built(root);
      assert.equal(output.get("static/logo.svg")?.toString(), "<svg/>");
      await write(
        root,
        "specs/home.screen.html",
        '---\ntitle: Home\n---\n<img src="../../logo.svg"><link rel="stylesheet" href="../../consumer-package/theme.css">',
      );
      const nested = await command(root, "build", [
        "--no-changes",
        "--out=.context/site",
      ]).result;
      assert.equal(nested.code, 1, nested.stderr);
      assert.equal(
        nested.stderr,
        protectedResource(
          "consumer-package/theme.css",
          "private package or output tree",
        ),
      );
      assert.deepEqual(await files(path.join(root, ".context/site")), output);
      assert.ok(
        ![...output.keys()].some((name) =>
          name.startsWith("static/consumer-package/"),
        ),
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
test(
  "portable entry names matching build directories survive the static boundary",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture();
    try {
      const names = [
        "dist",
        "target",
        "build",
        "coverage",
        "mokly-static",
        "test-results",
        "playwright-report",
      ];
      for (const name of names)
        await write(
          root,
          `specs/${name}.screen.html`,
          `---\ntitle: ${name}\n---\n<h1>${name}</h1>`,
        );
      const output = await built(root);
      for (const name of names) {
        assert.ok(output.has(`view/${name}/index.html`));
        assert.ok(output.has(`mokly-viewer/entries/${name}.json`));
        assert.ok(
          output.has(`static/mokly-generated/${name}/index.desktop.html`),
        );
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
