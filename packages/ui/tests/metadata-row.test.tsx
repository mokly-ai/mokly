import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  FlowIcon,
  ScreenIcon,
  VariantIcon,
  WorkspaceIcon,
} from "../src/icons/icons.js";
import {
  EntryChip,
  MetadataChips,
  MetadataCode,
  MetadataLink,
  MetadataRow,
  type EntryChipKind,
} from "../src/metadata-row/metadata-row.js";

test("a metadata row draws the label, then the value", () => {
  assert.equal(
    renderToStaticMarkup(
      <MetadataRow label="Source">
        <MetadataCode>mockups/home.tsx</MetadataCode>
      </MetadataRow>,
    ),
    '<div class="mbk-meta-row"><span class="mbk-meta-k">Source</span><span class="mbk-meta-v"><code class="mbk-code">mockups/home.tsx</code></span></div>',
  );
});

test("a row with marks carries them, and a hidden row hides", () => {
  const row = (hidden: boolean) =>
    renderToStaticMarkup(
      <MetadataRow
        hidden={hidden}
        label="Changed views"
        mark="data-workspace-changed-views"
        valueMark="data-workspace-changed-views-value"
      >
        {hidden ? "" : "Mobile · Dark"}
      </MetadataRow>,
    );
  assert.equal(
    row(false),
    '<div class="mbk-meta-row" data-workspace-changed-views=""><span class="mbk-meta-k">Changed views</span><span class="mbk-meta-v" data-workspace-changed-views-value="">Mobile · Dark</span></div>',
  );
  assert.equal(
    row(true),
    '<div class="mbk-meta-row" data-workspace-changed-views="" hidden=""><span class="mbk-meta-k">Changed views</span><span class="mbk-meta-v" data-workspace-changed-views-value=""></span></div>',
  );
});

test("the props presentation draws a term and its description for a list", () => {
  assert.equal(
    renderToStaticMarkup(
      <dl>
        <MetadataRow label="label" presentation="props">
          <code>&quot;Continue&quot;</code>
        </MetadataRow>
      </dl>,
    ),
    "<dl><div><dt>label</dt><dd><code>&quot;Continue&quot;</code></dd></div></dl>",
  );
  render(
    <dl>
      <MetadataRow label="label" presentation="props">
        Continue
      </MetadataRow>
    </dl>,
  );
  assert.equal(screen.getByRole("term").textContent, "label");
  assert.equal(screen.getByRole("definition").textContent, "Continue");
});

test("a value's link, code chip, and chip group keep the shell's classes", () => {
  assert.equal(
    renderToStaticMarkup(
      <MetadataChips>
        <MetadataLink href="/view/guide/">Guide</MetadataLink>
        <MetadataCode>docs/notes.md</MetadataCode>
      </MetadataChips>,
    ),
    '<span class="mbk-chips"><a class="mbk-meta-link" href="/view/guide/">Guide</a><code class="mbk-code">docs/notes.md</code></span>',
  );
  render(<MetadataLink href="/view/guide/">Guide</MetadataLink>);
  assert.equal(
    screen.getByRole("link", { name: "Guide" }).getAttribute("href"),
    "/view/guide/",
  );
});

test("an entry chip links to its entry with the glyph of its kind", () => {
  const glyphs: Record<EntryChipKind, string> = {
    "use-case": renderToStaticMarkup(<FlowIcon size={11} />),
    variant: renderToStaticMarkup(<VariantIcon size={11} />),
    component: renderToStaticMarkup(
      <WorkspaceIcon name="components" size={11} />,
    ),
    screen: renderToStaticMarkup(<ScreenIcon size={11} />),
  };
  const kinds: readonly EntryChipKind[] = [
    "use-case",
    "variant",
    "component",
    "screen",
  ];
  for (const kind of kinds)
    assert.equal(
      renderToStaticMarkup(
        <EntryChip href="/view/tour/" kind={kind} title="Tour" />,
      ),
      `<a class="mbk-chip ${kind === "use-case" ? "flow" : "screen"}" href="/view/tour/">${glyphs[kind]}Tour</a>`,
      kind,
    );
  render(
    <EntryChip href="/view/tour/?snapshot=1" kind="variant" title="Tour" />,
  );
  assert.equal(
    screen.getByRole("link", { name: "Tour" }).getAttribute("href"),
    "/view/tour/?snapshot=1",
  );
});
