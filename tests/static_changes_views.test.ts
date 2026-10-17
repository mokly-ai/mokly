import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { build, git, screen, write } from "./helpers/static_changes.js";
import { publicationFixture } from "./helpers/static_publication.js";

for (const scenario of [
  "screen",
  "component",
  "global",
  "add-screen",
  "add-component",
  "add-global",
] as const)
  test(
    `static Changes maps surviving entries to changed when schemes change: ${scenario}`,
    { timeout: 120_000 },
    async () => {
      const root = await publicationFixture();
      const adding = scenario.startsWith("add-");
      const config = (schemes: string[]) =>
        JSON.stringify({
          colorSchemes: schemes,
          review: { base: "fixture-base" },
        });
      const home = (schemes: string[]) =>
        screen("<h1>Home</h1>", `colorSchemes: ${JSON.stringify(schemes)}\n`);
      const card = (schemes?: string[]) =>
        `---\ntitle: Card\nelement: ui-card\n${schemes ? `colorSchemes: ${JSON.stringify(schemes)}\n` : ""}propSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<p>Card</p>`;
      try {
        await write(
          root,
          "mokly.config.json",
          config(scenario === "add-global" ? ["light"] : ["light", "dark"]),
        );
        await write(
          root,
          "specs/home.screen.html",
          home(adding ? ["light"] : ["light", "dark"]),
        );
        await write(
          root,
          "specs/card.component.html",
          card(adding ? ["light"] : ["light", "dark"]),
        );
        await write(root, "specs/note.md", "# Note\n\nSame content\n");
        if (scenario === "global" || scenario === "add-global") {
          await write(root, "specs/home.screen.html", screen("<h1>Home</h1>"));
          await write(root, "specs/card.component.html", card());
        }
        await git(root, "add", "-A");
        await git(root, "commit", "-qm", "base schemes");
        await git(root, "branch", "fixture-base");
        if (scenario === "global" || scenario === "add-global")
          await write(
            root,
            "mokly.config.json",
            config(adding ? ["light", "dark"] : ["light"]),
          );
        else if (scenario === "component" || scenario === "add-component")
          await write(
            root,
            "specs/card.component.html",
            card(adding ? ["light", "dark"] : ["light"]),
          );
        else
          await write(
            root,
            "specs/home.screen.html",
            home(scenario === "add-screen" ? ["light", "dark"] : ["light"]),
          );
        const built = await build(root);
        const entries =
          scenario === "component" || scenario === "add-component"
            ? built.index.components
            : scenario === "global" || scenario === "add-global"
              ? [
                  ...built.index.screens,
                  ...built.index.documents,
                  ...built.index.components,
                ]
              : built.index.screens;
        assert.equal(built.index.changesStatus, "ready");
        assert.deepEqual(built.index.removedEntries, []);
        for (const entry of entries) {
          assert.deepEqual(entry.changes, {
            status: "ready",
            kind: "changed",
            included: true,
          });
          if ("comparison" in entry)
            assert.deepEqual(entry.comparison, {
              status: "ready",
              kind: "changed",
              eligible: true,
            });
          if ("views" in entry)
            for (const view of entry.views) {
              assert.equal(view.comparison.status, "ready");
              if (view.comparison.status === "ready") {
                assert.equal(view.comparison.eligible, false);
                assert.equal(
                  view.comparison.kind,
                  view.colorScheme === "dark" ? "added" : "unmodified",
                );
              }
            }
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    },
  );
