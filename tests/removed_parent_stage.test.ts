import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { controlsUnavailable } from "../packages/viewer/src/shell/component_controls_state.js";
import { EntryDetailsBody } from "../packages/viewer/src/shell/details.js";
import { toRouteTarget } from "../packages/viewer/src/shell/target.js";
import { workspaceData } from "../packages/viewer/src/shell/workspace_data.js";
import { WorkspaceStage } from "../packages/viewer/src/shell/workspace_stage.js";
import { WorkspaceVariantBar } from "../packages/viewer/src/shell/workspace_variant_bar.js";

import {
  branchPointShell,
  routedEntry,
  type BranchPointShellSide,
} from "./helpers/branch_point_shell.js";

/** The workspace stage and Details that one routed entry renders. */
function workspace(side: BranchPointShellSide, path: string) {
  const entry = routedEntry(side, path);
  const context = side.context(entry);
  const data = workspaceData(side.catalogue, context, entry);
  const target = toRouteTarget(entry);
  if (target?.kind !== "entry") throw new Error(`No target for ${path}`);
  return {
    data,
    bar: renderToStaticMarkup(createElement(WorkspaceVariantBar, { data })),
    details: renderToStaticMarkup(
      createElement(EntryDetailsBody, { catalogue: side.catalogue, entry }),
    ),
    stage: renderToStaticMarkup(
      createElement(WorkspaceStage, {
        catalogue: side.catalogue,
        context,
        data,
        previewViews: [],
        target,
        variantRemoved: false,
      }),
    ),
  };
}

/** Each moved-variant link as path, address and label. */
function movedLinks(html: string): string[][] {
  return [
    ...html.matchAll(
      /<a class="mbk-empty-link" data-moved-variant="([^"]+)" href="([^"]+)">([^<]+)<\/a>/gu,
    ),
  ].map((match) => [match[1]!, match[2]!, match[3]!]);
}

test("a removed parent whose variants all moved lists them instead of empty controls", async (t) => {
  const shell = await branchPointShell("departed-variants");
  t.after(shell.remove);
  for (const side of shell.sides) {
    const { bar, data, details, stage } = workspace(side, "link-button");
    assert.equal(data.removed, true, side.name);
    assert.deepEqual(data.variants, [], side.name);
    assert.equal(bar, "", `${side.name}: no empty variant bar`);
    assert.match(stage, /<h2>This component was removed<\/h2>/u, side.name);
    assert.match(stage, /<p>Its variants moved to new places\.<\/p>/u);
    assert.doesNotMatch(stage, /Select a comparison/u, side.name);
    assert.deepEqual(
      movedLinks(stage),
      [
        [
          "library/action/quiet",
          "/view/library/action/quiet/",
          "Action › quiet",
        ],
        [
          "library/toolbar/inline",
          "/view/library/toolbar/inline/",
          "Toolbar › inline",
        ],
      ],
      side.name,
    );
    assert.equal(
      controlsUnavailable(data, undefined, false, true),
      "This component has no saved variants to edit.",
      side.name,
    );
    assert.doesNotMatch(details, /Location/u, `${side.name}: top level`);
  }
});

test("a removed variant inside a folder keeps its Location and its comparison", async (t) => {
  const shell = await branchPointShell("moved-parent");
  t.after(shell.remove);
  for (const side of shell.sides) {
    const { bar, data, details, stage } = workspace(
      side,
      "library/action/secondary",
    );
    assert.match(bar, /data-workspace-variant="library\/action\/secondary"/u);
    assert.match(stage, /Select a comparison to see the previous version\./u);
    assert.equal(movedLinks(stage).length, 0, side.name);
    assert.equal(
      controlsUnavailable(data, data.variants.at(-1), false, true),
      "Choose an available saved variant to edit props.",
      side.name,
    );
    assert.match(
      details,
      /Location<\/span><span class="mbk-meta-v">Library<\/span>/u,
      side.name,
    );
  }
});
