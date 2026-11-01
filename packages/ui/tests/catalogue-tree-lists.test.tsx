import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CatalogueTree,
  type NavigationLeaf,
} from "../src/catalogue-tree/catalogue-tree.js";

import { folder, leaf, link, specs, tree } from "./navigation-fixture.js";

const CARD = link("components/card", { kind: "component", label: "Card" });

function sections(row: NavigationLeaf) {
  return [specs([row])];
}

test("an entry with variants pairs its link with a toggle named after the entry", () => {
  const html = renderToStaticMarkup(
    <CatalogueTree
      {...tree({
        sections: sections(
          leaf(CARD, {
            filterOpen: false,
            variants: [
              link("components/card/small", {
                depth: 1,
                kind: "component",
                label: "Small",
              }),
            ],
          }),
        ),
      })}
    />,
  );
  assert.match(
    html,
    /<div class="mbk-nav-leaf mbk-reset"><a class="mbk-nav-row mbk-reset" data-entry-id="components\/card" [^>]*>[^]*?<\/a><button aria-controls="root-mb-nav-variants-specs-components\/card" aria-expanded="false" aria-label="Show variants of Card" class="mbk-nav-variants-toggle mbk-reset" data-nav-variants-label="Card" data-nav-variants-noun="variants" data-nav-variants-toggle="root-mb-nav-variants-specs-components\/card" type="button"><svg [^>]*width="16"[^>]*>[^]*?<\/svg><\/button><\/div><div class="mbk-nav-variants mbk-reset" data-filter-open="0" data-nav-disclosure="variants:components\/card" data-nav-variants="" hidden="" id="root-mb-nav-variants-specs-components\/card"><a class="mbk-nav-row mbk-reset" data-entry-id="components\/card\/small" [^>]*><span class="mbk-nav-ico variant mbk-reset">/,
  );
  // The entry's own link is never hidden; its leaf hides it with the toggle.
  assert.doesNotMatch(
    /<a class="mbk-nav-row mbk-reset" data-entry-id="components\/card" [^>]*>/.exec(
      html,
    )?.[0] ?? "",
    /hidden/,
  );
});

test("an open list of members names the contents and lists variants before members", () => {
  render(
    <CatalogueTree
      {...tree({
        sections: sections(
          leaf(CARD, {
            open: true,
            rows: [
              folder("components/card/parts", { depth: 1, label: "Parts" }),
              leaf(link("components/card/guide", { depth: 1, kind: "page" })),
            ],
            variants: [link("components/card/small", { depth: 1 })],
          }),
        ),
      })}
    />,
  );
  const toggle = screen.getByRole("button", { name: "Hide contents of Card" });
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  assert.equal(toggle.getAttribute("data-nav-variants-noun"), "contents");
  const list = document.getElementById(
    toggle.getAttribute("aria-controls") ?? "",
  );
  assert.ok(list);
  assert.equal(list.hasAttribute("hidden"), false);
  assert.deepEqual(
    [...list.children].map(
      (child) =>
        child.getAttribute("data-entry-id") ??
        child.getAttribute("data-nav-folder"),
    ),
    [
      "components/card/small",
      "folder:components/card/parts",
      "components/card/guide",
    ],
  );
});

test("a hidden entry hides its row and its list, open or not", () => {
  const { container } = render(
    <CatalogueTree
      {...tree({
        sections: sections(
          leaf(CARD, {
            hidden: true,
            open: true,
            variants: [link("components/card/small", { hidden: true })],
          }),
        ),
      })}
    />,
  );
  assert.equal(
    container.querySelector(".mbk-nav-leaf")?.hasAttribute("hidden"),
    true,
  );
  const list = container.querySelector("[data-nav-variants]");
  assert.equal(list?.hasAttribute("hidden"), true);
  assert.equal(list?.firstElementChild?.hasAttribute("hidden"), true);
});

test("the toggle reports its list's new state, also where summaries are native", () => {
  const choices: [string, boolean][] = [];
  const onDisclosure = (key: string, open: boolean) =>
    choices.push([key, open]);
  const { rerender } = render(
    <CatalogueTree
      {...tree({
        interactive: false,
        onDisclosure,
        sections: sections(leaf(CARD, { variants: [link("card/small")] })),
      })}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Show variants of Card" }),
  );
  rerender(
    <CatalogueTree
      {...tree({
        onDisclosure,
        sections: sections(
          leaf(CARD, { open: true, variants: [link("card/small")] }),
        ),
      })}
    />,
  );
  const toggle = screen.getByRole("button", { name: "Hide variants of Card" });
  fireEvent.click(toggle);
  assert.deepEqual(choices, [
    ["variants:components/card", true],
    ["variants:components/card", false],
  ]);
  // Without a callback the toggle reports nothing.
  rerender(
    <CatalogueTree
      {...tree({
        sections: sections(leaf(CARD, { variants: [link("card/small")] })),
      })}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Show variants of Card" }),
  );
  assert.equal(choices.length, 2);
  const row = screen.getByRole("link", { name: /^Card/ });
  assert.equal(row.getAttribute("data-entry-id"), "components/card");
});
