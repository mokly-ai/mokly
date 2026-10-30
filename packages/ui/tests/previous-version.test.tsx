import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { PreviousVersion } from "../src/previous-version/previous-version.js";

const DESCRIPTOR = JSON.stringify({ path: "a", kind: "page", title: "A" });

test("the band names the previous version above the stage host", () => {
  assert.equal(
    renderToStaticMarkup(
      <PreviousVersion descriptor={DESCRIPTOR} viewport="both">
        <i>state</i>
      </PreviousVersion>,
    ),
    '<p class="mbk-previous mbk-reset">Showing previous version</p><div aria-live="polite" class="mbk-preview mbk-reset" data-mokly-preview="{&quot;path&quot;:&quot;a&quot;,&quot;kind&quot;:&quot;page&quot;,&quot;title&quot;:&quot;A&quot;}" data-mokly-stage="" data-viewport="both"><i>state</i></div>',
  );
});

test("a light-only document adds the note and the fallback mark to the band", () => {
  assert.equal(
    renderToStaticMarkup(
      <PreviousVersion descriptor="{}" lightOnly viewport="mobile" />,
    ),
    '<p class="mbk-previous mbk-reset" data-color-scheme-fallback="">Showing previous version<span class="mbk-frame-scheme-note mbk-reset"> — Light only</span></p><div aria-live="polite" class="mbk-preview mbk-reset" data-mokly-preview="{}" data-mokly-stage="" data-viewport="mobile"></div>',
  );
});

test("the host announces each state and carries the request's descriptor", () => {
  const { container } = render(
    <PreviousVersion descriptor={DESCRIPTOR} viewport="desktop">
      <p role="status">Loading</p>
    </PreviousVersion>,
  );
  const host = container.querySelector(".mbk-preview");
  assert.ok(host);
  assert.equal(host.getAttribute("aria-live"), "polite");
  assert.equal(host.getAttribute("data-mokly-preview"), DESCRIPTOR);
  assert.equal(host.getAttribute("data-viewport"), "desktop");
  assert.ok(screen.getByRole("status").parentElement === host);
  assert.ok(
    screen.getByText("Showing previous version").nextElementSibling === host,
  );
});
