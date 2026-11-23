import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { ComparedRail } from "../src/compared-rail/compared-rail.js";

import { assertSameElement } from "./dom-assertions.js";

/** The text of each version on the rail, then the line under it, if any. */
function rail(container: HTMLElement) {
  return {
    versions: screen
      .getAllByRole("listitem")
      .map((version) => version.textContent),
    note: container.querySelector("p")?.textContent ?? null,
  };
}

test("both versions show on the rail: Before at the branch point on the base, then Current on this branch", () => {
  assert.equal(
    renderToStaticMarkup(<ComparedRail base="origin/main" />),
    '<div class="mbk-compared mbk-reset"><ol class="mbk-compared-rail mbk-reset">' +
      '<li class="mbk-compared-version mbk-reset" data-compared-side="before"><span aria-hidden="true" class="mbk-compared-dot mbk-reset"></span><span class="mbk-compared-side mbk-reset">Before</span> <span class="mbk-compared-name mbk-reset">Branch point on <code class="mbk-reset">origin/main</code></span></li>' +
      '<li class="mbk-compared-version mbk-reset" data-compared-side="current"><span aria-hidden="true" class="mbk-compared-dot mbk-reset"></span><span class="mbk-compared-side mbk-reset">Current</span> <span class="mbk-compared-name mbk-reset">This branch</span></li>' +
      "</ol></div>",
  );
});

test("an added entry shows Current alone, with the line that there is no base", () => {
  const { container } = render(
    <ComparedRail base="origin/main" outcome="added" />,
  );
  assert.deepEqual(rail(container), {
    versions: ["Current This branch"],
    note: "Added on this branch, so there is no base to compare.",
  });
});

test("a removed entry shows Before alone, with the line that there is no current version", () => {
  const { container } = render(
    <ComparedRail base="origin/main" outcome="removed" />,
  );
  assert.deepEqual(rail(container), {
    versions: ["Before Branch point on origin/main"],
    note: "Removed on this branch, so there is no current version to compare.",
  });
});

test("an empty or blank base reads Branch point alone", () => {
  for (const base of ["", "  "]) {
    const { container, unmount } = render(<ComparedRail base={base} />);
    assert.deepEqual(
      rail(container),
      { versions: ["Before Branch point", "Current This branch"], note: null },
      JSON.stringify(base),
    );
    assertSameElement(
      container.querySelector("code"),
      null,
      JSON.stringify(base),
    );
    unmount();
  }
});
