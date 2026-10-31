import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { WorkspaceEvidence } from "../src/shell/workspace_evidence.js";
import { publicWorkspace } from "../src/viewer/public_workspace.js";

import { componentWorkspaceFixture } from "./component_workspace_fixture.js";

const { catalogue, model, source, sourceVariant } = componentWorkspaceFixture();

const VARIANT_ROW = "<div><dt>Saved variant</dt><dd>Default</dd></div>";
const UNCHANGED_ROW = "<div><dt>Saved props</dt><dd>Unchanged</dd></div>";

test("a saved variant's evidence names it, and a loaded comparison says when its saved props stayed the same", () => {
  const data = publicWorkspace(catalogue, model, sourceVariant);
  // The fixture's saved variant keeps the same saved props on both sides.
  assert.ok(data.compared?.savedProps);
  const current = renderToStaticMarkup(
    <WorkspaceEvidence data={data} variantPath={sourceVariant.path} />,
  );
  assert.ok(
    current.includes(`<dl class="mbk-props">${VARIANT_ROW}</dl>`),
    current,
  );
  const loaded = renderToStaticMarkup(
    <WorkspaceEvidence compared data={data} variantPath={sourceVariant.path} />,
  );
  assert.ok(
    loaded.includes(
      `<dl class="mbk-props">${VARIANT_ROW}${UNCHANGED_ROW}</dl>`,
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
