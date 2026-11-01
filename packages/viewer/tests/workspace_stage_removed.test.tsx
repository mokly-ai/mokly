import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { Catalogue } from "../src/shell/catalogue.js";
import type { ShellContext } from "../src/shell/context.js";
import type { RouteTarget } from "../src/shell/target.js";
import type { WorkspaceData } from "../src/shell/workspace_data.js";
import { WorkspaceStage } from "../src/shell/workspace_stage.js";

/** The stage heading of one removed entry. */
function removedHeading(entry: Record<string, unknown>): string | undefined {
  const markup = renderToStaticMarkup(
    <WorkspaceStage
      catalogue={{} as Catalogue}
      context={{} as ShellContext}
      data={{ entry, removed: true } as unknown as WorkspaceData}
      previewViews={[]}
      target={{} as RouteTarget}
      variantRemoved={false}
    />,
  );
  return /<h2 class="mbk-reset">([^<]*)<\/h2>/.exec(markup)?.[1];
}

test("a removed variant names itself, not its surviving parent", () => {
  assert.equal(
    removedHeading({
      kind: "component",
      path: "components/card/archived",
      title: "Archived",
      variantOf: "components/card",
    }),
    "This variant was removed",
  );
  assert.equal(
    removedHeading({
      kind: "component",
      path: "components/retired",
      title: "Retired component",
    }),
    "This component was removed",
  );
  assert.equal(
    removedHeading({
      kind: "screen",
      path: "screens/retired",
      title: "Retired screen",
    }),
    "This screen was removed",
  );
});
