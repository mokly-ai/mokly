import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render } from "@testing-library/react";
import type { ComponentType } from "react";

import {
  BrandIcon,
  ChevronIcon,
  CollapseIcon,
  ComponentVariantIcon,
  CopyIcon,
  DocumentIcon,
  ExpandIcon,
  FlowIcon,
  FolderIcon,
  FolderOpenIcon,
  IconSvg,
  PageIcon,
  ScreenIcon,
  SearchIcon,
  TagIcon,
  VariantIcon,
  WorkspaceIcon,
  type WorkspaceIconName,
} from "../src/icons/icons.js";

/** Each glyph with the size it draws when the caller names none. */
const GLYPHS: readonly [string, ComponentType<{ size?: number }>, number][] = [
  ["BrandIcon", BrandIcon, 22],
  ["ChevronIcon", ChevronIcon, 13],
  ["CollapseIcon", CollapseIcon, 13],
  ["ComponentVariantIcon", ComponentVariantIcon, 15],
  ["CopyIcon", CopyIcon, 13],
  ["DocumentIcon", DocumentIcon, 13],
  ["ExpandIcon", ExpandIcon, 13],
  ["FlowIcon", FlowIcon, 13],
  ["FolderIcon", FolderIcon, 13],
  ["FolderOpenIcon", FolderOpenIcon, 13],
  ["PageIcon", PageIcon, 13],
  ["ScreenIcon", ScreenIcon, 13],
  ["SearchIcon", SearchIcon, 15],
  ["TagIcon", TagIcon, 13],
  ["VariantIcon", VariantIcon, 13],
];

const WORKSPACE_ICONS: readonly WorkspaceIconName[] = [
  "details",
  "components",
  "props",
  "usage",
  "highlight",
  "scheme",
  "viewport",
  "close",
  "caret",
];

/** The one svg a render draws. */
function drawn(container: HTMLElement): SVGSVGElement {
  const svgs = container.querySelectorAll("svg");
  assert.equal(svgs.length, 1);
  const svg = svgs[0];
  assert.ok(svg);
  return svg;
}

test("the icon frame is a decorative 24-unit stroke in the current colour", () => {
  const { container } = render(
    <IconSvg size={16}>
      <path d="M4 6h16" />
    </IconSvg>,
  );
  const svg = drawn(container);
  assert.deepEqual(
    Object.fromEntries(
      [
        "aria-hidden",
        "fill",
        "height",
        "stroke",
        "stroke-width",
        "viewBox",
        "width",
      ].map((name) => [name, svg.getAttribute(name)]),
    ),
    {
      "aria-hidden": "true",
      fill: "none",
      height: "16",
      stroke: "currentColor",
      "stroke-width": "2",
      viewBox: "0 0 24 24",
      width: "16",
    },
  );
  assert.equal(svg.querySelector("path")?.getAttribute("d"), "M4 6h16");
});

test("every glyph is decorative, has its default size, and takes a size", () => {
  for (const [name, Glyph, size] of GLYPHS) {
    const { container, unmount } = render(<Glyph />);
    const svg = drawn(container);
    assert.equal(svg.getAttribute("aria-hidden"), "true", name);
    assert.equal(svg.getAttribute("width"), String(size), name);
    assert.equal(svg.getAttribute("height"), String(size), name);
    assert.ok(svg.childElementCount > 0, name);
    unmount();
    const sized = render(<Glyph size={40} />);
    assert.equal(drawn(sized.container).getAttribute("width"), "40", name);
    sized.unmount();
  }
});

test("each workspace icon draws its own shape in the 18px frame", () => {
  const shapes = new Set<string>();
  for (const name of WORKSPACE_ICONS) {
    const { container, unmount } = render(<WorkspaceIcon name={name} />);
    const svg = drawn(container);
    assert.equal(svg.getAttribute("width"), "18", name);
    assert.equal(svg.getAttribute("aria-hidden"), "true", name);
    shapes.add(svg.innerHTML);
    unmount();
  }
  assert.equal(shapes.size, WORKSPACE_ICONS.length);
  const { container } = render(<WorkspaceIcon name="close" size={12} />);
  assert.equal(drawn(container).getAttribute("width"), "12");
});
