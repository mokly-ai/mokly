/**
 * The viewport select of the workspace view controls draws its glyph and then
 * the one down chevron of `@mokly/ui/icons`, which the Appearance selector
 * also draws, at the workspace icon size.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { ChevronDownIcon, WorkspaceIcon } from "@mokly/ui/icons";

import { WorkspaceControls } from "../src/shell/workspace_controls.js";

test("the viewport select draws its glyph, then the package down chevron", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceControls
      changedViews={[]}
      dark={false}
      effectiveColorScheme="light"
    />,
  );
  const glyphs = /<label class="mbk-icon-select"[^>]*>(.*?)<select/su.exec(
    markup,
  )?.[1];
  assert.equal(
    glyphs,
    renderToStaticMarkup(<WorkspaceIcon name="viewport" />) +
      renderToStaticMarkup(<ChevronDownIcon size={18} />),
  );
});
