import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import type { ViewerInteractiveDescriptor } from "../src/client/interactive_capability.js";
import { SHELL_CSS } from "../src/shell/css.js";
import { renderHydratedShellPage } from "../src/shell/document.js";
import { viewerCatalogue, viewerView } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";

const model = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v4.json",
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
/** The mark that gives a toolbar with Static/Live its own narrow row. */
const OFFERED = ' data-preview-mode-offered=""';
const OFFERED_TOOLS =
  /^<div class="mbk-view-tools" data-preview-mode-offered="" role="group" aria-label="View options">/;

function served(
  screenPath: string,
  descriptor: ViewerInteractiveDescriptor | null = interactive,
  eligible: boolean | null = true,
): string {
  const view = viewerView(display, { ...defaultSelection, screenPath });
  const entry = view.kind === "target" ? view.target.entry : undefined;
  return renderHydratedShellPage(
    view,
    {
      base: "origin/main",
      contentVersion: model.revision.content,
      readModel: model,
      updateVersion: 4,
      ...(descriptor ? { interactive: descriptor } : {}),
      ...(descriptor &&
      entry &&
      (entry.kind === "component" || entry.kind === "screen") &&
      eligible !== null
        ? {
            workspaceInteractive: {
              entryPath: entry.path,
              entryKind: entry.kind,
              value: eligible,
            },
          }
        : {}),
    },
    privateDisplay,
  );
}

/** The view toolbar from its opening tag, so its own marks are compared too. */
function toolbar(html: string): string {
  const start = html.indexOf('<div class="mbk-view-tools"');
  assert.notEqual(start, -1, "the view toolbar is rendered");
  return html.slice(start, html.indexOf("</div>", start));
}

test("Serve offers Static and Live for current screens and saved variants", () => {
  for (const id of ["product/browse/home", "components/action"]) {
    const tools = toolbar(served(id));
    assert.match(tools, OFFERED_TOOLS);
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
  const tools = toolbar(
    served("product/browse/home", { ...interactive, state: "failed" }),
  );
  assert.match(tools, OFFERED_TOOLS);
  assert.match(tools, CONTROL);
  assert.match(
    tools,
    /aria-description="Live preview is unavailable for this view." aria-disabled="true" aria-pressed="false" data-preview-mode-option="live"/,
  );
});

test("an opted-out or unknown entry keeps its toolbar with no control or gap", () => {
  for (const id of ["product/browse/home", "components/action"]) {
    const eligible = toolbar(served(id));
    const staticOnly = toolbar(served(id, null));
    assert.doesNotMatch(staticOnly, CONTROL);
    assert.equal(staticOnly.includes(OFFERED), false, id);
    for (const eligibility of [false, null]) {
      const tools = toolbar(served(id, interactive, eligibility));
      assert.doesNotMatch(tools, CONTROL, `${id} ${String(eligibility)}`);
      assert.match(tools, /data-workspace-viewport=""/);
      assert.match(tools, /data-workspace-highlight=""/);
      assert.equal(tools, staticOnly, `${id} ${String(eligibility)}`);
      assert.equal(
        tools,
        eligible.replace(CONTROL_MARKUP, "").replace(OFFERED, ""),
      );
    }
    for (const state of ["failed", "ready"] as const)
      assert.doesNotMatch(
        toolbar(served(id, { ...interactive, state }, false)),
        CONTROL,
      );
  }
});

test("no control appears without Live, on pages, flows or removed entries", () => {
  for (const html of [
    served("product/browse/home", null),
    served("components/action", null),
  ]) {
    assert.doesNotMatch(html, CONTROL);
    assert.equal(html.includes(OFFERED), false);
  }
  for (const id of ["guide", "tour", "removed-screen"]) {
    const html = served(id);
    assert.doesNotMatch(html, CONTROL, id);
    assert.equal(html.includes(OFFERED), false, id);
  }
});

test("only a toolbar with Static and Live takes its own narrow row", () => {
  const rules = [
    ...SHELL_CSS.matchAll(/([^{};]*\.mbk-view-tools[^{};]*)\{([^}]*)\}/g),
  ].map(([, selector, body]) => [selector!.trim(), body!.trim()] as const);
  const rows = rules.filter(([, body]) => /flex:\s*1 0 100%/.test(body));
  assert.deepEqual(rows, [
    [
      ".mbk-workspace .mbk-view-tools[data-preview-mode-offered]",
      "flex: 1 0 100%;",
    ],
  ]);
  assert.ok(
    rules.some(
      ([selector, body]) =>
        selector === ".mbk-workspace .mbk-view-tools" &&
        body === "margin-left: 0;",
    ),
    "a narrow toolbar without the control wraps from the start of its line",
  );
});

test("an exported page never offers Live, even from a Live context", () => {
  const deploymentId = "c".repeat(64);
  for (const screenPath of ["product/browse/home", "components/action"]) {
    const exported = renderHydratedShellPage(
      viewerView(display, { ...defaultSelection, screenPath }),
      {
        base: "origin/main",
        delivery: {
          canonicalPath: "/",
          comparisonUrl: null,
          deploymentId,
          schemaVersion: 3,
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
