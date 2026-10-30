import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  UsageList,
  UsageStatus,
  type UsageRow,
} from "../src/usage-list/usage-list.js";

import { assertSameElement } from "./dom-assertions.js";

function row(title: string, overrides: Partial<UsageRow> = {}): UsageRow {
  return {
    direct: true,
    href: `/view/${title.toLowerCase()}/?viewport=desktop&scheme=light&instance=a`,
    id: JSON.stringify([title.toLowerCase(), false]),
    instances: 1,
    key: title,
    removed: false,
    title,
    views: 2,
    ...overrides,
  };
}

test("a section keeps the shell's markup: its heading, then a row for each consumer", () => {
  assert.equal(
    renderToStaticMarkup(
      <UsageList
        affected={[]}
        usedBy={[
          row("Home"),
          row("Farewell", {
            direct: false,
            id: '["farewell",true]',
            instances: 3,
            removed: true,
            views: 1,
          }),
        ]}
      />,
    ),
    '<section class="mbk-reset" data-usage-section="used-by"><h3 class="mbk-reset">Used by</h3><ul class="mbk-usage-list mbk-reset">' +
      '<li class="mbk-reset" data-usage-link="[&quot;home&quot;,false]"><a class="mbk-reset" href="/view/home/?viewport=desktop&amp;scheme=light&amp;instance=a">Home</a><small class="mbk-reset">Direct use · 1 instances · 2 views</small></li>' +
      '<li class="mbk-reset" data-usage-link="[&quot;farewell&quot;,true]"><a class="mbk-reset" href="/view/farewell/?viewport=desktop&amp;scheme=light&amp;instance=a">Farewell · Removed</a><small class="mbk-reset">Nested use · 3 instances · 1 views</small></li>' +
      "</ul></section>",
  );
});

test("Used by always shows, and the affected consumers show only when there are some", () => {
  const { rerender } = render(<UsageList affected={[]} usedBy={[]} />);
  assert.deepEqual(
    screen.getAllByRole("heading").map((heading) => heading.textContent),
    ["Used by"],
  );
  assert.ok(screen.getByText("No recorded consumers."));
  rerender(<UsageList affected={[row("Welcome")]} usedBy={[]} />);
  assert.deepEqual(
    screen.getAllByRole("heading").map((heading) => heading.textContent),
    ["Used by", "Affected screens and components"],
  );
  const affected = screen
    .getByRole("heading", { name: "Affected screens and components" })
    .closest("section");
  assert.ok(affected);
  assert.equal(affected.getAttribute("data-usage-section"), "affected");
  assert.ok(within(affected).getByRole("link", { name: "Welcome" }));
});

test("a row keeps its link element, and the focus on it, while its key stays", () => {
  const { rerender } = render(
    <UsageList affected={[]} usedBy={[row("Home")]} />,
  );
  const link = screen.getByRole("link", { name: "Home" });
  link.focus();
  rerender(
    <UsageList
      affected={[]}
      usedBy={[row("Home", { href: "/view/home/?comparison=side" })]}
    />,
  );
  assertSameElement(screen.getByRole("link", { name: "Home" }), link);
  assert.equal(link.getAttribute("href"), "/view/home/?comparison=side");
  assertSameElement(document.activeElement, link);
});

test("the tab's data loads in a status, and a failed load offers Try again", () => {
  assert.equal(
    renderToStaticMarkup(<UsageStatus status="loading" />),
    '<section aria-label="Usage status" class="mbk-reset" data-usage-section="status"><p class="mbk-reset" role="status">Loading usage…</p></section>',
  );
  let retries = 0;
  render(<UsageStatus onRetry={() => (retries += 1)} status="failed" />);
  const section = screen.getByRole("region", { name: "Usage status" });
  assert.equal(
    within(section).getByRole("alert").textContent,
    "Usage couldn’t be loaded.",
  );
  fireEvent.click(within(section).getByRole("button", { name: "Try again" }));
  assert.equal(retries, 1);
});

test("an unchecked catalogue says that usage is unavailable until it is checked", () => {
  assert.equal(
    renderToStaticMarkup(<UsageStatus status="unchecked" />),
    '<p class="mbk-reset" data-usage-section="status">Usage is unavailable until the catalogue has been checked.</p>',
  );
});
