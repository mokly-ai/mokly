import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { publicWorkspace } from "../src/shell/public_workspace.js";
import { WorkspaceEvidence } from "../src/shell/workspace_evidence.js";

import { componentWorkspaceFixture } from "./component_workspace_fixture.js";

const { catalogue, model, source, sourceVariant } = componentWorkspaceFixture();

const VARIANT_ROW =
  '<div class="mbk-reset"><dt class="mbk-reset">Saved variant</dt><dd class="mbk-reset">Default</dd></div>';
const UNCHANGED_ROW =
  '<div class="mbk-reset"><dt class="mbk-reset">Saved props</dt><dd class="mbk-reset">Unchanged</dd></div>';

test("a saved variant's evidence names it, and a loaded comparison says when its saved props stayed the same", () => {
  const data = publicWorkspace(catalogue, model, sourceVariant);
  // The fixture's saved variant keeps the same saved props on both sides.
  assert.ok(data.compared?.savedProps);
  const current = renderToStaticMarkup(
    <WorkspaceEvidence data={data} variantPath={sourceVariant.path} />,
  );
  assert.ok(
    current.includes(`<dl class="mbk-props mbk-reset">${VARIANT_ROW}</dl>`),
    current,
  );
  const loaded = renderToStaticMarkup(
    <WorkspaceEvidence compared data={data} variantPath={sourceVariant.path} />,
  );
  assert.ok(
    loaded.includes(
      `<dl class="mbk-props mbk-reset">${VARIANT_ROW}${UNCHANGED_ROW}</dl>`,
    ),
    loaded,
  );
  const parent = publicWorkspace(catalogue, model, source);
  assert.doesNotMatch(
    renderToStaticMarkup(
      <WorkspaceEvidence
        compared
        data={parent}
        variantPath={sourceVariant.path}
      />,
    ),
    /Saved variant/,
  );
});
