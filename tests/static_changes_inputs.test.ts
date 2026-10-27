import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import type { EntryDetailV3 } from "../packages/viewer/src/generated/catalogue/EntryDetailV3.js";

import { build, git, json, screen, write } from "./helpers/static_changes.js";
import { publicationFixture } from "./helpers/static_publication.js";

test(
  "static input changes belong to their caller and require the same component counterpart",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture();
    try {
      await write(
        root,
        "mokly.config.json",
        '{"review":{"base":"fixture-base"}}',
      );
      for (const name of ["child", "alternate"])
        await write(
          root,
          `specs/${name}.component.html`,
          `---\ntitle: ${name}\nelement: ui-${name}\npropSchema: {type: object, additionalProperties: false, required: [label], properties: {label: {type: string}}}\nprops: {label: Own}\n---\n<p>{{label}}</p>`,
        );
      const parent = (child: string, label: string) =>
        `---\ntitle: Parent\nelement: ui-parent\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<ui-${child} mokly-instance="nested" label="${label}" />`;
      await write(
        root,
        "specs/parent.component.html",
        parent("child", "Before"),
      );
      await write(
        root,
        "specs/home.screen.html",
        screen('<ui-parent mokly-instance="outer" />'),
      );
      await git(root, "add", "-A");
      await git(root, "commit", "-qm", "base nested inputs");
      await git(root, "branch", "fixture-base");
      await write(
        root,
        "specs/parent.component.html",
        parent("child", "After"),
      );
      let built = await build(root);
      const home = await json<EntryDetailV3>(
        built.output,
        "mokly-viewer/entries/home.json",
      );
      assert.deepEqual(home.workspace!.inputChanges, []);
      const changedParent = await json<EntryDetailV3>(
        built.output,
        "mokly-viewer/entries/parent.json",
      );
      assert.ok(
        changedParent.workspace!.inputChanges.some(
          (change) => change.instanceId === "nested",
        ),
      );
      await write(
        root,
        "specs/parent.component.html",
        parent("alternate", "Replacement"),
      );
      built = await build(root);
      const replaced = await json<EntryDetailV3>(
        built.output,
        "mokly-viewer/entries/parent.json",
      );
      assert.deepEqual(replaced.workspace!.inputChanges, []);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
