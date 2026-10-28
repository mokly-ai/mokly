import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import type { EntryDetailV2 } from "../packages/viewer/src/generated/catalogue/EntryDetailV2.js";

import { build, git, json, write } from "./helpers/static_changes.js";
import { files } from "./helpers/static_faults.js";
import { publicationFixture } from "./helpers/static_publication.js";

test(
  "Markdown edits enter static Changes without a synthetic visual review entry",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture();
    try {
      await write(
        root,
        "mokly.config.json",
        '{"review":{"base":"fixture-base"}}',
      );
      await write(root, "specs/note.md", "# Note\n\nBefore text\n");
      await git(root, "add", "-A");
      await git(root, "commit", "-qm", "base document");
      await git(root, "branch", "fixture-base");
      await write(root, "specs/note.md", "# Note\n\nAfter text\n");
      const built = await build(root);
      assert.deepEqual(built.index.documents[0]!.changes, {
        status: "ready",
        kind: "changed",
        included: true,
      });
      const prefix = built.index.comparisonUrl!.slice(0, -1);
      assert.deepEqual(
        [
          ...built.index.screens,
          ...built.index.components,
          ...built.index.pages,
          ...built.index.documents,
          ...built.index.useCases,
        ]
          .filter(
            (entry) =>
              entry.changes.status === "ready" && entry.changes.included,
          )
          .map((entry) => entry.path),
        ["note"],
      );
      const note = await json<EntryDetailV2>(
        built.output,
        "mokly-viewer/entries/note.json",
      );
      assert.equal(note.entry.kind, "document");
      assert.deepEqual(note.views, []);
      assert.equal(note.before, undefined);
      const output = await files(built.output);
      assert.match(
        output
          .get(`${prefix}/snapshots/before/mokly-generated/note/index.html`)!
          .toString(),
        /Before text/u,
      );
      assert.match(
        output
          .get(`${prefix}/snapshots/after/mokly-generated/note/index.html`)!
          .toString(),
        /After text/u,
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

test(
  "renderer head style edits enter static comparison rule evidence",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture(true);
    try {
      await write(
        root,
        "mokly.config.json",
        '{"review":{"base":"fixture-base"},"renderer":"renderer.ts"}',
      );
      await write(
        root,
        "specs/home.mockup.ts",
        "import React from 'react'; import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'Home',description:'',relatedDocs:[],props:{},render(){return React.createElement('p',{className:'subject'},'Home');}});",
      );
      const renderer = (color: string) =>
        `import React from 'react'; export default ({node})=>React.createElement(React.Fragment,null,React.createElement('style',null,'.subject{color:${color}}'),node);`;
      await write(root, "renderer.ts", renderer("red"));
      await git(root, "add", "-A");
      await git(root, "commit", "-qm", "base renderer");
      await git(root, "branch", "fixture-base");
      await write(root, "renderer.ts", renderer("blue"));
      const built = await build(root);
      const detail = await json<EntryDetailV2>(
        built.output,
        "mokly-viewer/entries/home.json",
      );
      for (const view of detail.views)
        assert.ok(
          view.resourceEvidence!.rules.some(
            (rule) => rule.status === "matched" && rule.owner.kind === "entry",
          ),
        );
      const prefix = built.index.comparisonUrl!.slice(0, -1);
      const output = await files(built.output);
      const before = output.get(
        `${prefix}/snapshots/before/mokly-generated/home/index.desktop.html`,
      )!;
      const after = output.get(
        `${prefix}/snapshots/after/mokly-generated/home/index.desktop.html`,
      )!;
      assert.notDeepEqual(before, after);
      assert.match(before.toString(), />Home<\/p>/u);
      assert.match(after.toString(), />Home<\/p>/u);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
