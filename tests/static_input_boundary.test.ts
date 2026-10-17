import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { files } from "./helpers/static_faults.js";
import { command, publicationFixture } from "./helpers/static_publication.js";

async function fixture() {
  const root = await publicationFixture(true);
  await fs.mkdir(path.join(root, "assets"));
  const inputs = {
    "mokly.config.json": JSON.stringify({
      renderer: "renderer.ts",
      stylesheets: [{ match: "**", stylesheets: ["theme.css"] }],
    }),
    "renderer.ts": "export default input => ({ node: input.node });\n",
    "theme.css": '@import "./more.css"; body { color: black }\n',
    "more.css": "h1 { font-weight: bold }\n",
    "helper.ts": 'export const message = "Stable catalogue";\n',
    "specs/extra.screen.html":
      '---\ntitle: Extra\n---\n<h1>Extra</h1><img src="../../assets/logo.svg">\n',
    "specs/_folder.json": "{}\n",
    "assets/logo.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>\n',
    "unrelated.txt": "outside the input set\n",
    "specs/unmatched.txt": "outside the discovery globs\n",
  };
  for (const [file, text] of Object.entries(inputs))
    await fs.writeFile(path.join(root, file), text);
  await render(root, "");
  return root;
}

async function render(root: string, mutation: string) {
  await fs.writeFile(
    path.join(root, "specs/home.mockup.ts"),
    `import fs from 'node:fs';
import {definePage} from '@mokly/mokly';
import {message} from '../helper.ts';
export default definePage({title:'Home',description:'',relatedDocs:[],render(){
${mutation}
return '<!doctype html><html><head><title>Home</title></head><body><h1>'+message+'</h1><img src="../../assets/logo.svg"></body></html>';
}});`,
  );
}

const build = (root: string) =>
  command(root, "build", [
    "--no-changes",
    "--sidecars=1",
    "--strict",
    "--out=.context/site",
  ]).result;

test(
  "edits outside the selected input boundary during rendering do not abort a build",
  { timeout: 120_000 },
  async () => {
    const root = await fixture();
    try {
      for (const file of ["unrelated.txt", "specs/unmatched.txt"]) {
        await render(
          root,
          `fs.appendFileSync(${JSON.stringify(file)}, 'changed');`,
        );
        const result = await build(root);
        assert.equal(result.code, 0, result.stderr);
        assert.match(
          await fs.readFile(path.join(root, file), "utf8"),
          /changed/u,
        );
        const output = await files(path.join(root, ".context/site"));
        assert.ok(
          [...output].some(
            ([name, bytes]) =>
              name.startsWith("static/mokly-generated/home/") &&
              bytes.toString().includes("Stable catalogue"),
          ),
        );
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

test(
  "parent globs do not fingerprint unrelated files in explicitly selected child roots",
  { timeout: 120_000 },
  async () => {
    const root = await fixture();
    try {
      await fs.rm(path.join(root, "specs/_folder.json"));
      await fs.mkdir(path.join(root, "catalog/target"), { recursive: true });
      await fs.writeFile(
        path.join(root, "catalog/guide.md"),
        "---\ntitle: Guide\n---\n# Guide\n",
      );
      await fs.writeFile(
        path.join(root, "catalog/target/unrelated.md"),
        "unrelated\n",
      );
      await fs.writeFile(
        path.join(root, "catalog/target/home.screen.html"),
        "---\ntitle: Target\n---\n<h1>Target</h1>\n",
      );
      const config = JSON.parse(
        await fs.readFile(path.join(root, "mokly.config.json"), "utf8"),
      ) as Record<string, unknown>;
      config.roots = [
        { dir: "catalog", files: ["**/*.md"] },
        { dir: "catalog/target", files: ["**/*.screen.html"], path: "target" },
        { dir: "specs", files: ["**/*.mockup.ts"] },
      ];
      await fs.writeFile(
        path.join(root, "mokly.config.json"),
        JSON.stringify(config),
      );
      await render(
        root,
        "fs.appendFileSync('catalog/target/unrelated.md', 'changed');",
      );
      const result = await build(root);
      assert.equal(result.code, 0, result.stderr);
      assert.match(
        await fs.readFile(
          path.join(root, "catalog/target/unrelated.md"),
          "utf8",
        ),
        /changed/u,
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

test(
  "each selected input kind aborts changed-generation installation and keeps the earlier output",
  { timeout: 120_000 },
  async () => {
    for (const file of [
      "mokly.config.json",
      "renderer.ts",
      "theme.css",
      "more.css",
      "helper.ts",
      "specs/home.mockup.ts",
      "specs/extra.screen.html",
      "specs/_folder.json",
      "assets/logo.svg",
    ]) {
      const root = await fixture();
      try {
        const first = await build(root);
        assert.equal(first.code, 0, first.stderr);
        const previous = await files(path.join(root, ".context/site"));
        await render(
          root,
          `fs.appendFileSync(${JSON.stringify(file)}, '\\n');`,
        );
        const result = await build(root);
        assert.equal(result.code, 1, `${file}: ${result.stderr}`);
        assert.match(
          result.stderr,
          /\[mokly\/export-invalid\] Inputs changed during the build:/u,
        );
        assert.match(result.stderr, /Build again\./u);
        assert.deepEqual(
          await files(path.join(root, ".context/site")),
          previous,
          file,
        );
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    }
  },
);

test(
  "matching root additions and removals during rendering abort installation",
  { timeout: 120_000 },
  async () => {
    for (const [file, mutation] of [
      [
        "new.screen.html",
        `fs.writeFileSync('specs/new.screen.html', '---\\ntitle: New\\n---\\n<h1>New</h1>');`,
      ],
      [
        "extra.screen.html",
        "fs.rmSync('specs/extra.screen.html', {force:true});",
      ],
    ]) {
      const root = await fixture();
      try {
        await render(root, mutation!);
        const result = await build(root);
        assert.equal(result.code, 1, result.stderr);
        assert.match(
          result.stderr,
          /\[mokly\/export-invalid\] Inputs changed during the build:/u,
        );
        assert.ok(result.stderr.includes(file!));
        await assert.rejects(fs.stat(path.join(root, ".context/site")), {
          code: "ENOENT",
        });
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    }
  },
);
