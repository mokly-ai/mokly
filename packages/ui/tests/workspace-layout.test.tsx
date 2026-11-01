import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { renderToString } from "react-dom/server";

import { WorkspaceLayout } from "../src/workspace-layout/workspace-layout.js";

import { assertSameElement } from "./dom-assertions.js";

function workspace(busy?: boolean, ref = createRef<HTMLElement>()) {
  return (
    <WorkspaceLayout
      {...(busy === undefined ? {} : { busy })}
      header={<h2>Header</h2>}
      inspector={<aside>Inspector</aside>}
      overlay={<b>Labels</b>}
      preview={<i>Stage</i>}
      previewStatus={<p role="status">Rendering</p>}
      ref={ref}
      variantBar={<nav aria-label="Variants" />}
    />
  );
}

test("the workspace lays out its header, variants, preview, inspector, and overlay", () => {
  assert.equal(
    renderToString(workspace()),
    '<section class="mbk-workspace mbk-reset" data-workspace=""><h2>Header</h2><nav aria-label="Variants"></nav><div class="mbk-workspace-panes mbk-reset"><div class="mbk-preview-pane mbk-reset" data-workspace-preview=""><div class="mbk-preview-busy mbk-reset"><i>Stage</i></div><p role="status">Rendering</p></div><aside>Inspector</aside></div><b>Labels</b></section>',
  );
});

test("the preview is busy only while a render is pending", () => {
  const { container, rerender } = render(workspace(true));
  const busy = container.querySelector(".mbk-preview-busy");
  assert.equal(busy?.getAttribute("aria-busy"), "true");
  rerender(workspace(false));
  assert.equal(busy?.hasAttribute("aria-busy"), false);
});

test("the host receives the workspace and finds the preview pane in it", () => {
  const section = createRef<HTMLElement>();
  const { container } = render(workspace(false, section));
  assertSameElement(section.current, container.firstElementChild);
  const pane = section.current?.querySelector("[data-workspace-preview]");
  assertSameElement(screen.getByText("Rendering").parentElement, pane);
  assertSameElement(pane?.nextElementSibling, screen.getByText("Inspector"));
});
