import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { exportCatalogue } from "../dist/export/run.js";
import { viewRoute } from "../packages/viewer/dist/data.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";
import type { WorkspaceData } from "../packages/viewer/dist/shell/workspace_data.js";
import { buildPreview } from "../scripts/preview/catalogue.mjs";

import { componentEntrySource } from "./helpers/component_fixture.js";
import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";

function workspace(html: string): WorkspaceData {
  const match =
    /<script[^>]*data-workspace-data=""[^>]*>([\s\S]*?)<\/script>/.exec(html);
  assert.ok(match);
  return JSON.parse(match[1]!) as WorkspaceData;
}
test("static export keeps component Changes, affected screens, saved variants and authenticated metadata", async (t) => {
  const source = componentEntrySource();
  const fixture = await createExportFixture(source, {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  t.after(fixture.close);
  await fs.writeFile(
    fixture.entryPath,
    source.replace(
      "<button data-viewport=",
      '<button className="changed" data-viewport=',
    ),
  );
  const exported = await exportCatalogue(fixture.config, { outDir: "site" });
  assert.ok(exported.comparisonUrl);
  const files = await directoryFiles(fixture.output);
  const result = parseReviewResult(
    JSON.parse(files.get(exported.comparisonUrl.slice(1))!.toString()),
  );
  assert.equal(result.schemaVersion, 6);
  if (result.schemaVersion !== 6) return;
  assert.deepEqual(
    result.changes.map((item) => (item.after ?? item.before)!.path),
    ["action"],
  );
  const action = workspace(files.get("view/action/index.html")!.toString());
  const home = workspace(files.get("view/home/index.html")!.toString());
  assert.equal(action.variants.length, 2);
  assert.ok(action.affected.some((item) => item.entryId === "home"));
  assert.equal(home.change, undefined);
  assert.equal(home.status, "Changed");
  assert.deepEqual(
    home.relatedComponents.map((item) => item.title),
    ["Action"],
  );
  assert.ok(files.has("view/action/index.html"));
  assert.ok(files.has("view/action/default/index.html"));
  assert.equal(
    [...files.keys()].some(
      (name) => name.startsWith("id/") || name.includes(".variants/"),
    ),
    false,
  );
  for (const view of action.views)
    assert.ok(files.has(`static/mokly-generated/${view.path}`));
  assert.ok(files.has("mokly-viewer/client/component_geometry.js"));
  assert.ok(!files.has("mokly-viewer/client/browser.js"));
  assert.equal(
    (await fs.readdir(path.join(fixture.output, "mokly-viewer"))).includes(
      "components",
    ),
    false,
  );
});

test("static export retains removed saved variants and baseline component consumers", async (t) => {
  const source = componentEntrySource();
  const fixture = await createExportFixture(source);
  t.after(fixture.close);
  const changed = source.replace(
    ', { slug: "disabled", title: "Disabled", props: { label: "Continue", disabled: true } }',
    "",
  );
  assert.notEqual(changed, source);
  await fs.writeFile(fixture.entryPath, changed);
  const exported = await exportCatalogue(fixture.config, { outDir: "site" });
  assert.ok(exported.comparisonUrl);
  const files = await directoryFiles(fixture.output);
  const action = workspace(files.get("view/action/index.html")!.toString());
  assert.deepEqual(
    action.variants.map((item) => [item.value.path, item.removed]),
    [
      ["action/default", false],
      ["action/disabled", true],
    ],
  );
  const result = parseReviewResult(
    JSON.parse(files.get(exported.comparisonUrl.slice(1))!.toString()),
  );
  if (result.schemaVersion !== 6) assert.fail("Expected component result");
  const removed = result.components
    .find((item) => item.path === "action")!
    .variants.find((item) => item.path === "action/disabled")!;
  assert.equal(removed.state, "removed");
  for (const view of removed.views)
    assert.ok(
      files.has(
        `${path.posix.dirname(exported.comparisonUrl.slice(1))}/snapshots/before/mokly-generated/${viewRoute(removed.path, view.viewport, view.colorScheme)}`,
      ),
    );
});

test("preview capture retains route-scoped workspace evidence after removing live capabilities", async (t) => {
  const source = componentEntrySource();
  const fixture = await createExportFixture(source);
  t.after(fixture.close);
  await fs.writeFile(
    fixture.entryPath,
    source.replace(
      "<button data-viewport=",
      '<button className="changed" data-viewport=',
    ),
  );
  await writeCompilation(
    await compileCatalogue(fixture.config),
    fixture.config,
  );
  const output = path.join(fixture.root, ".context/published");
  await buildPreview(fixture.config, output, { includeChanges: true });
  const actionPage = await fs.readFile(
    path.join(output, "view/action/index.html"),
    "utf8",
  );
  const homePage = await fs.readFile(
    path.join(output, "view/home/index.html"),
    "utf8",
  );
  assert.doesNotMatch(actionPage, /data-mokly-host-capabilities/);
  assert.doesNotMatch(actionPage, /react-host\.js/);
  assert.match(actionPage, /data-mokly-static=""/);
  assert.match(actionPage, /react-shell\.js/);
  assert.ok(
    workspace(actionPage).affected.some((item) => item.entryId === "home"),
  );
  assert.deepEqual(
    workspace(homePage).relatedComponents.map((item) => item.title),
    ["Action"],
  );
});
