import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { EntryDetailV3 } from "../packages/viewer/src/generated/catalogue/EntryDetailV3.js";

import { build, git, json, screen, write } from "./helpers/static_changes.js";
import { publicationFixture } from "./helpers/static_publication.js";

test(
  "static Changes keeps zero ignored-only moved and removed variant classifications",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture();
    try {
      await write(
        root,
        "mokly.config.json",
        '{"review":{"base":"fixture-base"}}',
      );
      await write(
        root,
        "specs/ignored.screen.html",
        screen('<h1>Kept</h1><mokly-ignore id="clock">Before</mokly-ignore>'),
      );
      await write(
        root,
        "specs/card.component.html",
        "---\ntitle: Historical Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\nvariants: [{slug: compact, title: Compact, props: {}}]\n---\n<p>Card</p>",
      );
      await write(
        root,
        "specs/page.page.html",
        "---\ntitle: Page\n---\n<!doctype html><html><head></head><body><p>Page content</p></body></html>",
      );
      await git(root, "add", "-A");
      await git(root, "commit", "-qm", "base catalogue");
      await git(root, "branch", "fixture-base");
      const zero = await build(root);
      assert.match(zero.stdout, /Changes ready · 0 changes/u);
      assert.ok(
        zero.index.screens.every(
          (entry) =>
            entry.changes.status === "ready" && !entry.changes.included,
        ),
      );
      assert.ok(
        zero.index.screens.every((entry) =>
          entry.views.every(
            (view) =>
              view.comparison.status === "ready" && !view.comparison.eligible,
          ),
        ),
      );
      await write(
        root,
        "specs/ignored.screen.html",
        screen('<h1>Kept</h1><mokly-ignore id="clock">After</mokly-ignore>'),
      );
      await write(root, "unused.txt", "not rendered");
      const ignored = await build(root);
      assert.match(ignored.stdout, /0 changes · 1 ignored-only/u);
      await write(
        root,
        "specs/moved.screen.html",
        screen("<h1>Home</h1>", "movedFrom: home\n"),
      );
      await fs.rm(path.join(root, "specs/home.screen.html"));
      await write(
        root,
        "specs/new-page.page.html",
        "---\ntitle: Page\nmovedFrom: page\n---\n<!doctype html><html><head></head><body><p>Page content</p></body></html>",
      );
      await fs.rm(path.join(root, "specs/page.page.html"));
      await write(
        root,
        "specs/card.component.html",
        "---\ntitle: Historical Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<p>Card</p>",
      );
      const moved = await build(root);
      assert.equal(
        moved.index.screens.find((entry) => entry.path === "moved")!
          .previousPath,
        "home",
      );
      assert.equal(
        moved.index.pages.find((entry) => entry.path === "new-page")!
          .previousPath,
        "page",
      );
      assert.deepEqual(
        moved.index.removedEntries.map((entry) => entry.entry.path),
        ["card/compact"],
      );
      const removed = moved.index.removedEntries[0]!;
      assert.equal(removed.parentTitle, "Historical Card");
      assert.equal(removed.preview, undefined);
      assert.ok(
        "comparison" in removed.entry &&
          removed.entry.comparison.status === "ready" &&
          removed.entry.comparison.eligible,
      );
      for (const name of ["home", "page"])
        await assert.rejects(
          fs.stat(path.join(moved.output, `view/${name}/index.html`)),
          { code: "ENOENT" },
        );
      const historical = await json<EntryDetailV3>(
        moved.output,
        `${moved.index.comparisonUrl!}entries/card/compact.json`,
      );
      assert.equal(historical.entry.snapshotId, removed.snapshotId);
      assert.ok(
        historical.views.every(
          (view) => view.usage.status === "ready" && view.resourceEvidence,
        ),
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

test(
  "static detail workspaces preserve component impact and changed caller props",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture();
    try {
      await write(
        root,
        "mokly.config.json",
        '{"review":{"base":"fixture-base"}}',
      );
      const component = (body: string) =>
        `---\ntitle: Button\nelement: ui-button\npropSchema: {type: object, additionalProperties: false, required: [label], properties: {label: {type: string}}}\nprops: {label: Own}\n---\n<button>${body} {{label}}</button>`;
      await write(root, "specs/button.component.html", component("Before"));
      await write(
        root,
        "specs/home.screen.html",
        screen('<ui-button mokly-instance="button" label="Old" />'),
      );
      await write(
        root,
        "specs/affected.screen.html",
        screen('<ui-button mokly-instance="button" label="Same" />'),
      );
      await git(root, "add", "-A");
      await git(root, "commit", "-qm", "base components");
      await git(root, "branch", "fixture-base");
      await write(root, "specs/button.component.html", component("After"));
      await write(
        root,
        "specs/home.screen.html",
        screen('<ui-button mokly-instance="button" label="New" />'),
      );
      const built = await build(root);
      const button = await json<EntryDetailV3>(
        built.output,
        "mokly-viewer/entries/button.json",
      );
      assert.ok(
        button.workspace!.usedBy.some((use) => use.entryPath === "home"),
      );
      assert.ok(
        button.workspace!.affected.some((use) => use.entryPath === "affected"),
      );
      const affected = await json<EntryDetailV3>(
        built.output,
        "mokly-viewer/entries/affected.json",
      );
      assert.ok(
        affected.workspace!.relatedComponents.some(
          (entry) => entry.path === "button",
        ),
      );
      assert.equal(affected.workspace!.comparisonEligible, true);
      const home = await json<EntryDetailV3>(
        built.output,
        "mokly-viewer/entries/home.json",
      );
      assert.ok(
        home.workspace!.inputChanges.some(
          (change) => change.instanceId === "button",
        ),
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
