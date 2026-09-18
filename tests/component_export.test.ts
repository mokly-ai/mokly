import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { exportCatalogue } from "../dist/export/run.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";
import type { WorkspaceData } from "../packages/viewer/dist/shell/workspace_data.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";

function workspace(html: string): WorkspaceData {
  const match =
    /<script type="application\/json" data-workspace-data="">([\s\S]*?)<\/script>/.exec(
      html,
    );
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
  assert.equal(result.schemaVersion, 3);
  if (result.schemaVersion !== 3) return;
  assert.deepEqual(
    result.changes.map((item) => (item.after ?? item.before)!.id),
    ["action"],
  );
  const action = workspace(
    files.get("view/components/action.html")!.toString(),
  );
  const home = workspace(files.get("view/screens/home.html")!.toString());
  assert.equal(action.variants.length, 2);
  assert.ok(action.affected.some((item) => item.route === "screens/home.html"));
  assert.equal(home.change, undefined);
  assert.equal(home.status, "Changed");
  assert.deepEqual(
    home.relatedComponents.map((item) => item.title),
    ["Action"],
  );
  assert.ok(files.has("id/action/index.html"));
  assert.equal(exported.idRoutes["action"], "/view/components/action.html");
  for (const view of action.views) assert.ok(files.has(`static/${view.path}`));
  assert.ok(files.has("__mokly/client/component_geometry.js"));
  assert.ok(!files.has("__mokly/client/browser.js"));
  assert.equal(
    (await fs.readdir(path.join(fixture.output, "__mokly"))).includes(
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
    ', { id: "disabled", title: "Disabled", props: { label: "Continue", disabled: true } }',
    "",
  );
  assert.notEqual(changed, source);
  await fs.writeFile(fixture.entryPath, changed);
  const exported = await exportCatalogue(fixture.config, { outDir: "site" });
  assert.ok(exported.comparisonUrl);
  const files = await directoryFiles(fixture.output);
  const action = workspace(
    files.get("view/components/action.html")!.toString(),
  );
  assert.deepEqual(
    action.variants.map((item) => [item.value.id, item.removed]),
    [
      ["default", false],
      ["disabled", true],
    ],
  );
  const result = parseReviewResult(
    JSON.parse(files.get(exported.comparisonUrl.slice(1))!.toString()),
  );
  if (result.schemaVersion !== 3) assert.fail("Expected component result");
  const removed = result.components
    .find((item) => item.id === "action")!
    .variants.find((item) => item.id === "disabled")!;
  assert.equal(removed.state, "removed");
  for (const view of removed.views)
    assert.ok(
      files.has(
        `${path.posix.dirname(exported.comparisonUrl.slice(1))}/${view.beforePath!}`,
      ),
    );
});
