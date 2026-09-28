import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import type { ViewerInteractiveDescriptor } from "../src/client/interactive_capability.js";
import { renderHydratedShellPage } from "../src/shell/document.js";
import { viewerCatalogue, viewerView } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";

const model = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);
const display = viewerCatalogue(model);
const { publicModel: _publicModel, ...privateDisplay } = display;
const interactive: ViewerInteractiveDescriptor = {
  generation: "a".repeat(32),
  port: 4174,
  state: "idle",
};
const CONTROL =
  /<span aria-label="Preview mode" class="mbk-seg mbk-preview-mode"/;
const CONTROL_MARKUP =
  /<span aria-label="Preview mode" class="mbk-seg mbk-preview-mode"[^]*?<\/span>/;

function served(
  screenId: string,
  descriptor: ViewerInteractiveDescriptor | null = interactive,
  eligible: boolean | null = true,
): string {
  const view = viewerView(display, { ...defaultSelection, screenId });
  const entry = view.kind === "target" ? view.target.entry : undefined;
  return renderHydratedShellPage(
    view,
    {
      base: "origin/main",
      contentVersion: model.revision.content,
      readModel: model,
      updateVersion: 4,
      ...(descriptor ? { interactive: descriptor } : {}),
      ...(descriptor && entry && eligible !== null
        ? {
            workspaceInteractive: {
              entryId: entry.id,
              route: entry.route,
              value: eligible,
            },
          }
        : {}),
    },
    privateDisplay,
  );
}

function toolbar(html: string): string {
  const start = html.indexOf('aria-label="View options"');
  assert.notEqual(start, -1, "the view toolbar is rendered");
  return html.slice(start, html.indexOf("</div>", start));
}

test("Serve offers Static and Live for current screens and saved variants", () => {
  for (const id of ["home", "action"]) {
    const tools = toolbar(served(id));
    assert.match(tools, CONTROL);
    assert.match(
      tools,
      /<button aria-pressed="true" data-preview-mode-option="static" title="Show the static preview" type="button">Static<\/button>/,
    );
    assert.match(
      tools,
      /<button aria-pressed="false" data-preview-mode-option="live" title="Interact with the live preview" type="button">Live<\/button>/,
    );
    assert.ok(
      tools.indexOf("data-workspace-viewport") < tools.indexOf("Preview mode"),
    );
    assert.ok(
      tools.indexOf("Preview mode") < tools.indexOf("data-workspace-highlight"),
    );
  }
});

test("a failed generation keeps the control with Live described as unavailable", () => {
  const tools = toolbar(served("home", { ...interactive, state: "failed" }));
  assert.match(tools, CONTROL);
  assert.match(
    tools,
    /aria-description="Live preview is unavailable for this view." aria-disabled="true" aria-pressed="false" data-preview-mode-option="live"/,
  );
});

test("an opted-out or unknown entry keeps its toolbar with no control or gap", () => {
  for (const id of ["home", "action"]) {
    const eligible = toolbar(served(id));
    for (const eligibility of [false, null]) {
      const tools = toolbar(served(id, interactive, eligibility));
      assert.doesNotMatch(tools, CONTROL, `${id} ${String(eligibility)}`);
      assert.match(tools, /data-workspace-viewport=""/);
      assert.match(tools, /data-workspace-highlight=""/);
      assert.equal(tools, eligible.replace(CONTROL_MARKUP, ""));
    }
    for (const state of ["failed", "ready"] as const)
      assert.doesNotMatch(
        toolbar(served(id, { ...interactive, state }, false)),
        CONTROL,
      );
  }
});

test("no control appears without Live, on pages, flows or removed entries", () => {
  assert.doesNotMatch(served("home", null), CONTROL);
  assert.doesNotMatch(served("action", null), CONTROL);
  for (const id of ["guide", "tour", "removed-screen"])
    assert.doesNotMatch(served(id), CONTROL, id);
});

test("an exported page never offers Live, even from a Live context", () => {
  const deploymentId = "c".repeat(64);
  for (const screenId of ["home", "action"]) {
    const exported = renderHydratedShellPage(
      viewerView(display, { ...defaultSelection, screenId }),
      {
        base: "origin/main",
        delivery: {
          canonicalPath: "/",
          comparisonUrl: null,
          deploymentId,
          idRoutes: {},
          schemaVersion: 2,
        },
        interactive: { ...interactive, state: "ready" },
        readModel: { ...model, deploymentId },
        updateVersion: 0,
      },
    );
    assert.match(exported, /aria-label="View options"/);
    assert.doesNotMatch(exported, CONTROL);
    assert.doesNotMatch(exported, /data-mokly-host-capability-state/);
  }
});
