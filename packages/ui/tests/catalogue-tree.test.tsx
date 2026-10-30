import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CatalogueTree,
  type NavigationRow,
  type NavigationSection,
} from "../src/catalogue-tree/catalogue-tree.js";

import { folder, leaf, link, specs, tree } from "./navigation-fixture.js";

/** The static markup of one section with `rows`. */
function markup(rows: NavigationRow[], fields?: Partial<NavigationSection>) {
  return renderToStaticMarkup(
    <CatalogueTree {...tree({ sections: [specs(rows, fields)] })} />,
  );
}

function summary(name: string): HTMLElement {
  const label = screen.getByText(name);
  const row = label.closest("summary");
  assert.ok(row instanceof HTMLElement, name);
  return row;
}

/**
 * Click a summary and report whether no handler canceled the click. happy-dom
 * toggles a `<details>` before React's delegated handler can cancel a mouse
 * click, which a browser does not, so this dispatches a plain click event,
 * which happy-dom does not treat as an activation.
 */
function activate(element: HTMLElement): boolean {
  return fireEvent(
    element,
    new Event("click", { bubbles: true, cancelable: true }),
  );
}

test("a section is a native disclosure with its keys, its filter mark, and its label", () => {
  assert.match(
    markup([], { filterOpen: false }),
    /<details class="mbk-nav-section mbk-reset" data-filter-open="0" data-nav-disclosure="section:specs" data-nav-section="specs" open=""><summary class="mbk-nav-section-head mbk-reset"><span aria-hidden="true" class="mbk-nav-section-chevron mbk-reset"><svg [^>]*><polyline points="9 6 15 12 9 18"><\/polyline><\/svg><\/span>Specs<\/summary><\/details>/,
  );
  assert.match(
    markup([], { filterOpen: true, hidden: true, open: false }),
    /<details class="mbk-nav-section mbk-reset" data-filter-open="1" data-nav-disclosure="section:specs" data-nav-section="specs" hidden="">/,
  );
});

// Moved from the viewer's folder reveal store test, which called the activation
// helper that this component now holds.
test("a summary that is not interactive keeps its native toggle; an interactive one reports the new state", () => {
  const choices: [string, boolean][] = [];
  const onDisclosure = (key: string, open: boolean) =>
    choices.push([key, open]);
  const closed = { sections: [specs([], { open: false })] };
  const { container, rerender } = render(
    <CatalogueTree {...tree({ ...closed, interactive: false })} />,
  );
  // A mouse click that no handler cancels keeps the native toggle.
  assert.equal(fireEvent.click(summary("Specs")), true);
  assert.equal(container.querySelector("details")?.open, true);
  rerender(
    <CatalogueTree
      {...tree({ ...closed, interactive: false, onDisclosure })}
    />,
  );
  assert.equal(activate(summary("Specs")), true);
  assert.deepEqual(choices, []);
  rerender(<CatalogueTree {...tree({ ...closed, onDisclosure })} />);
  assert.equal(activate(summary("Specs")), false);
  assert.deepEqual(choices, [["section:specs", true]]);
});

test("a toggle event reports a state that differs from the shown one", () => {
  const choices: [string, boolean][] = [];
  const onDisclosure = (key: string, open: boolean) =>
    choices.push([key, open]);
  const sections = [specs([folder("product", { open: true })])];
  const { container, rerender } = render(
    <CatalogueTree {...tree({ onDisclosure, sections })} />,
  );
  const details = container.querySelector<HTMLDetailsElement>(
    'details[data-nav-folder="folder:product"]',
  );
  assert.ok(details);
  // A toggle that agrees with the shown state reports nothing.
  fireEvent(details, new Event("toggle"));
  assert.deepEqual(choices, []);
  // happy-dom fires the toggle event as soon as `open` changes.
  details.open = false;
  assert.deepEqual(choices, [["folder:specs:product", false]]);
  rerender(
    <CatalogueTree {...tree({ interactive: false, onDisclosure, sections })} />,
  );
  details.open = true;
  assert.deepEqual(choices, [["folder:specs:product", false]]);
});

test("a folder row shows both folder icons, its label, and a count above zero", () => {
  assert.match(
    markup([folder("product", { count: 2, depth: 1, filterOpen: true })]),
    /<details class="mbk-nav-group mbk-reset" data-filter-open="1" data-nav-folder="folder:product" data-nav-disclosure="folder:specs:product"><summary class="mbk-nav-row mbk-reset" style="[^"]*"><span class="mbk-nav-ico folder mbk-reset"><svg [^>]*><path [^>]*><\/path><\/svg><svg [^>]*><path [^>]*><\/path><\/svg><\/span><span class="mbk-nav-label mbk-reset">product<\/span><span class="mbk-nav-count mbk-reset">2<\/span><\/summary><\/details>/,
  );
  assert.doesNotMatch(markup([folder("empty")]), /mbk-nav-count/);
  assert.match(
    markup([folder("hidden", { hidden: true, open: true })]),
    /data-nav-disclosure="folder:specs:hidden" hidden="" open="">/,
  );
  const choices: [string, boolean][] = [];
  render(
    <CatalogueTree
      {...tree({
        onDisclosure: (key, open) => choices.push([key, open]),
        sections: [specs([folder("product", { open: true })])],
      })}
    />,
  );
  assert.equal(activate(summary("product")), false);
  assert.deepEqual(choices, [["folder:specs:product", false]]);
});

test("rows indent by depth and draw one guide line for each ancestor level", () => {
  const guide = "linear-gradient(var(--mbk-guide), var(--mbk-guide))";
  const styles = [0, 1, 2].map((depth) => {
    const match = /<a [^>]*style="([^"]*)"/.exec(
      markup([leaf(link("home", { depth }))]),
    );
    assert.ok(match, String(depth));
    return match[1];
  });
  assert.deepEqual(styles, [
    "padding-left:8px;--mbk-indent:0px",
    `padding-left:24px;--mbk-indent:16px;background-image:${guide};background-position:15px 0;background-size:1px 100%;background-repeat:no-repeat`,
    `padding-left:40px;--mbk-indent:32px;background-image:${guide}, ${guide};background-position:15px 0, 31px 0;background-size:1px 100%, 1px 100%;background-repeat:no-repeat`,
  ]);
});

test("a row link carries its entry, its route, its marks, and the changed wording", () => {
  const row = link("product/home", {
    changed: true,
    changedVariants: true,
    current: true,
    hidden: true,
    href: "/view/product/home/?snapshot=s1",
    index: true,
    key: "removed:product/home",
    kind: "page",
    label: "Home · Removed",
    removed: true,
    removedPage: true,
    removedVariant: true,
    route: "/product/home",
    tags: ["checkout", "mobile"],
  });
  assert.match(
    markup([leaf(row)]),
    /<a aria-current="page" class="mbk-nav-row mbk-reset" data-changed="true" data-changed-variants="true" data-entry-id="product\/home" data-entry-kind="page" data-nav-index="" data-nav-row="" data-nav-removed="" data-removed-page="" data-removed-variant="" hidden="" data-route="\/product\/home" data-tags="checkout mobile" href="\/view\/product\/home\/\?snapshot=s1" style="[^"]*"><span class="mbk-nav-ico mbk-reset"><svg [^>]*>[^]*?<\/svg><\/span>Home · Removed<span class="mbk-nav-changed-text mbk-reset" data-nav-changed-text="">Changed<\/span><\/a>/,
  );
  assert.match(
    markup([leaf(link("home"))]),
    /<a class="mbk-nav-row mbk-reset" data-entry-id="home" data-entry-kind="screen" data-nav-row="" data-route="\/home" href="\/view\/home\/" style="[^"]*">/,
  );
});

test("each entry kind and each variant row has its own glyph", () => {
  const glyphs = (rows: NavigationRow[]) => {
    const { container, unmount } = render(
      <CatalogueTree {...tree({ sections: [specs(rows)] })} />,
    );
    const drawn = [...container.querySelectorAll("a[data-nav-row]")].map(
      (row) => {
        const icon = row.firstElementChild;
        assert.ok(icon);
        return [icon.className, icon.innerHTML] as const;
      },
    );
    unmount();
    return drawn;
  };
  const kinds = glyphs(
    (["screen", "page", "document", "component", "use-case"] as const).map(
      (kind) => leaf(link(kind, { kind })),
    ),
  );
  assert.deepEqual(
    kinds.map(([className]) => className),
    [
      "mbk-nav-ico mbk-reset",
      "mbk-nav-ico mbk-reset",
      "mbk-nav-ico mbk-reset",
      "mbk-nav-ico mbk-reset",
      "mbk-nav-ico flow mbk-reset",
    ],
  );
  assert.equal(new Set(kinds.map(([, svg]) => svg)).size, 5);
  const variants = glyphs([
    leaf(link("card", { kind: "component" }), {
      open: true,
      variants: [link("card/small", { kind: "component" })],
    }),
    leaf(link("home"), { open: true, variants: [link("home/empty")] }),
  ]);
  assert.deepEqual(
    variants.map(([className]) => className),
    [
      "mbk-nav-ico mbk-reset",
      "mbk-nav-ico variant mbk-reset",
      "mbk-nav-ico mbk-reset",
      "mbk-nav-ico variant mbk-reset",
    ],
  );
  assert.notEqual(variants[1]?.[1], variants[3]?.[1]);
  assert.notEqual(variants[1]?.[1], kinds[3]?.[1]);
});
