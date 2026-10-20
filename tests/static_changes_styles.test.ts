import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { EntryDetailV2 } from "../packages/viewer/src/generated/catalogue/EntryDetailV2.js";
import type { ReviewResultV8 } from "../packages/viewer/src/generated/catalogue/ReviewResultV8.js";

import { build, git, json, screen, write } from "./helpers/static_changes.js";
import { files } from "./helpers/static_faults.js";
import { publicationFixture, workspace } from "./helpers/static_publication.js";

test(
  "static Changes preserves dark-only render evidence without changing light views",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture(true);
    try {
      await write(
        root,
        "mokly.config.json",
        '{"review":{"base":"fixture-base"},"colorSchemes":["light","dark"]}',
      );
      const source = (dark: string) =>
        `import React from 'react'; import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'Home',description:'',relatedDocs:[],props:{},colorSchemes:['light','dark'],render(_props,{colorScheme}){return React.createElement('p',null,colorScheme==='dark'?'${dark}':'Light');}});`;
      await write(root, "specs/home.mockup.ts", source("Before"));
      await git(root, "add", "-A");
      await git(root, "commit", "-qm", "base dark views");
      await git(root, "branch", "fixture-base");
      await write(root, "specs/home.mockup.ts", source("After"));
      const built = await build(root);
      const home = built.index.screens.find((entry) => entry.path === "home")!;
      assert.equal(home.changes.status, "ready");
      for (const view of home.views) {
        assert.equal(view.comparison.status, "ready");
        if (view.comparison.status === "ready") {
          assert.equal(
            view.comparison.kind,
            view.colorScheme === "dark" ? "changed" : "unmodified",
          );
          assert.equal(view.comparison.eligible, view.colorScheme === "dark");
        }
      }
      const output = await files(built.output);
      await build(root);
      assert.deepEqual(await files(built.output), output);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

test(
  "static comparison captures matched and excluded CSS plus transitive resource edits",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture();
    try {
      await fs.symlink(
        path.join(workspace, "node_modules"),
        path.join(root, "node_modules"),
        "junction",
      );
      await write(
        root,
        "mokly.config.json",
        JSON.stringify({
          review: { base: "fixture-base" },
          stylesheets: [{ match: "**", stylesheets: ["theme.css"] }],
        }),
      );
      await write(
        root,
        "specs/home.screen.html",
        screen('<p class="matched">Home</p>'),
      );
      await write(root, "specs/empty.screen.html", screen("<p>Empty</p>"));
      await write(
        root,
        "theme.css",
        '@import "./child.css"; .unused{color:red} .matched{color:red}',
      );
      await write(root, "child.css", '.matched{background:url("./asset.svg")}');
      await write(
        root,
        "asset.svg",
        '<svg xmlns="http://www.w3.org/2000/svg"><title>Before</title></svg>',
      );
      await git(root, "add", "-A");
      await git(root, "commit", "-qm", "base styles");
      await git(root, "branch", "fixture-base");
      await write(
        root,
        "theme.css",
        '@import "./child.css"; .unused{color:blue} .matched{color:blue}',
      );
      await write(
        root,
        "asset.svg",
        '<svg xmlns="http://www.w3.org/2000/svg"><title>After</title></svg>',
      );
      const built = await build(root);
      const detail = await json<EntryDetailV2>(
        built.output,
        "mokly-viewer/entries/home.json",
      );
      for (const view of detail.views) {
        assert.ok(
          view.resourceEvidence!.rules.some(
            (rule) => rule.status === "matched",
          ),
        );
        assert.ok(view.resourceEvidence!.resources.length > 0);
      }
      const excluded = await json<EntryDetailV2>(
        built.output,
        "mokly-viewer/entries/empty.json",
      );
      assert.ok(
        excluded.views.every((view) =>
          view.resourceEvidence!.rules.some(
            (rule) => rule.status === "excluded" && rule.selector === "",
          ),
        ),
      );
      const review = await json<ReviewResultV8>(
        built.output,
        built.index.comparisonUrl!,
      );
      assert.equal(
        review.entries.find((entry) => entry.path === "home")!.state,
        "changed",
      );
      const prefix = path.posix.dirname(built.index.comparisonUrl!);
      const output = await files(built.output);
      for (const side of ["before", "after"]) {
        const asset = [...output].find(
          ([file]) =>
            file.startsWith(`${prefix}/snapshots/${side}/`) &&
            file.endsWith("asset.svg"),
        );
        assert.ok(asset);
        assert.match(
          asset[1].toString(),
          side === "before" ? /Before/u : /After/u,
        );
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
