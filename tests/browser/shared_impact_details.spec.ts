import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { compileCatalogue } from "../../packages/mokly/dist/build/compile.js";
import { writeCompilation } from "../../packages/mokly/dist/build/transaction.js";
import { loadConfig } from "../../packages/mokly/dist/config/load.js";
import { serve } from "../../packages/mokly/dist/server/serve.js";
import type { ReviewResultV5 } from "../../packages/viewer/dist/review/component_types.js";
import { componentEntrySource } from "../helpers/component_fixture.js";
import { startEvidenceFixture } from "../helpers/evidence_fixture.js";
import { createFixture, removeFixture } from "../helpers/fixture.js";

import { FILES_LEAD, openEvidence } from "./css_evidence_page.js";

test("a registered catalogue shows shared-impact-only files in a screen's Details from All", async ({
  page,
}) => {
  const fixture = await startEvidenceFixture(pathOnlyEntrySource());
  const { server, runtime, compilation } = fixture;
  try {
    expect(
      server.completeCatalogue?.(compilation.manifest, runtime.generation),
    ).toBe(true);
    server.publishUpdate({
      kind: "evidence",
      componentChanges: {
        baseline: compilation.manifest,
        result: sharedImpactOnlyResult(),
      },
      changedEntries: [],
      changesStatus: "ready",
    });

    await page.goto(`${server.url}/view/home/`);
    await expect(page.locator('[data-filter="all"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const evidence = await openEvidence(page);
    await expect(evidence.getByText(FILES_LEAD, { exact: true })).toBeVisible();
    await expect(evidence.getByRole("listitem")).toHaveText(["notes.md"]);
  } finally {
    await fixture.close();
  }
});

test("a real changed shared-impact file appears in screen and component Details from All", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const fixture = await createFixture(pathOnlyEntrySource());
  let running: Awaited<ReturnType<typeof serve>> | undefined;
  try {
    const config = await loadConfig(fixture.root);
    await writeCompilation(await compileCatalogue(config), config);
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: fixture.root, stdio: "pipe" });
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Mokly Test");
    git("config", "user.email", "mokly@example.invalid");
    git("add", ".");
    git("commit", "-qm", "test: catalogue baseline");
    await fs.appendFile(path.join(fixture.root, "notes.md"), "Changed input\n");
    running = await serve(config, { base: "main", port: 0, watch: false });

    await page.goto(`${running.url}/view/home/`);
    await expect(page.locator('[data-filter="all"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const evidence = await openEvidence(page);
    await expect(evidence.getByText(FILES_LEAD, { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(evidence.getByRole("listitem")).toHaveText(["notes.md"]);
    await page.goto(`${running.url}/view/action/`);
    await expect(page.locator('[data-filter="all"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const componentEvidence = await openEvidence(page);
    await expect(
      componentEvidence.getByText(
        "Changes to these files may affect this component:",
        { exact: true },
      ),
    ).toBeVisible({ timeout: 30_000 });
    await expect(componentEvidence.getByRole("listitem")).toHaveText([
      "notes.md",
    ]);
    await expect(componentEvidence).toContainText(
      "No changes to this saved view.",
    );
    await page.locator('[data-filter="changed"]').click();
    await expect(page.locator('[data-route="home/index.html"]')).toBeHidden();
    await expect(page.locator('[data-route="action/index.html"]')).toBeHidden();
  } finally {
    await running?.close();
    await removeFixture(fixture);
  }
});

function pathOnlyEntrySource(): string {
  return componentEntrySource().replaceAll(
    'dependencies: ["notes.md"]',
    "dependencies: []",
  );
}

function sharedImpactOnlyResult(): ReviewResultV5 {
  const address = { path: "home", title: "Home" };
  return {
    schemaVersion: 5 as const,
    baseRef: "main",
    baseCommit: "a".repeat(40),
    changedPaths: ["notes.md"],
    sharedImpact: ["notes.md"],
    ignoredImpact: [],
    screens: [
      {
        ...address,
        before: address,
        after: address,
        dependencies: [],
        sharedImpact: ["notes.md"],
        state: "unchanged",
        views: (["mobile", "desktop"] as const).flatMap((viewport) =>
          (["light", "dark"] as const).map((colorScheme) => ({
            viewport,
            colorScheme,
            state: "unchanged" as const,
            ignoredIds: [],
          })),
        ),
      },
    ],
    components: [],
    changes: [],
    affectedConsumers: [],
  };
}
