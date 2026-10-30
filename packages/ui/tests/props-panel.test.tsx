import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  PropSlots,
  PropValues,
  PropsMessage,
  PropsPanel,
  PropsStatus,
} from "../src/props-panel/props-panel.js";

const WORDING = {
  failed: "Props couldn’t be loaded.",
  loading: "Loading props…",
  retry: "Try again",
};

test("the supplied props are one named list of names and values in code", () => {
  const values = [
    { name: "hint", value: "Not set" },
    { name: "label", value: '"Continue"' },
  ];
  assert.equal(
    renderToStaticMarkup(<PropValues values={values} />),
    '<dl aria-label="Supplied props" class="mbk-props"><div><dt>hint</dt><dd><code>Not set</code></dd></div><div><dt>label</dt><dd><code>&quot;Continue&quot;</code></dd></div></dl>',
  );
  render(<PropValues values={values} />);
  const list = screen.getByLabelText("Supplied props");
  assert.deepEqual(
    within(list)
      .getAllByRole("term")
      .map((term) => term.textContent),
    ["hint", "label"],
  );
});

test("slots follow under their own heading, and no slot draws nothing", () => {
  assert.equal(
    renderToStaticMarkup(<PropSlots slots={["header", "footer"]} />),
    "<h4>Slots</h4><p>header</p><p>footer</p>",
  );
  assert.equal(renderToStaticMarkup(<PropSlots slots={[]} />), "");
  assert.equal(renderToStaticMarkup(<PropSlots />), "");
});

test("the message says why the tab shows no props, and is a status while its data loads", () => {
  assert.equal(
    renderToStaticMarkup(
      <PropsMessage>This entry renders without props.</PropsMessage>,
    ),
    '<p class="mbk-empty-copy">This entry renders without props.</p>',
  );
  render(
    <PropsMessage pending>Waiting for the component preview.</PropsMessage>,
  );
  const status = screen.getByRole("status");
  assert.equal(status.textContent, "Waiting for the component preview.");
  assert.equal(status.hasAttribute("class"), false);
});

test("an instance's props follow its heading and the link to its component", () => {
  assert.equal(
    renderToStaticMarkup(
      <PropsPanel
        instance={{
          href: "/view/components/action/",
          id: "footer",
          title: "Action",
        }}
        slots={["header · Supplied by this page"]}
        values={[{ name: "label", value: '"Go"' }]}
      />,
    ),
    '<h3>Action · footer</h3><a href="/view/components/action/">Open component</a><dl aria-label="Supplied props" class="mbk-props"><div><dt>label</dt><dd><code>&quot;Go&quot;</code></dd></div></dl><h4>Slots</h4><p>header · Supplied by this page</p>',
  );
  render(
    <PropsPanel
      instance={{
        href: "/view/components/action/",
        id: "footer",
        title: "Action",
      }}
      values={[]}
    />,
  );
  assert.equal(
    screen.getByRole("heading", { name: "Action · footer" }).tagName,
    "H3",
  );
  assert.equal(
    screen.getByRole("link", { name: "Open component" }).getAttribute("href"),
    "/view/components/action/",
  );
  assert.ok(screen.getByText("No data props supplied."));
});

test("an instance of an unknown component has no link, and props without an instance no heading", () => {
  assert.equal(
    renderToStaticMarkup(
      <PropsPanel
        instance={{ id: "footer", title: "components/unknown" }}
        values={[]}
      />,
    ),
    "<h3>components/unknown · footer</h3><p>No data props supplied.</p>",
  );
  assert.equal(
    renderToStaticMarkup(
      <PropsPanel slots={["header"]} values={[{ name: "a", value: "1" }]} />,
    ),
    '<dl aria-label="Supplied props" class="mbk-props"><div><dt>a</dt><dd><code>1</code></dd></div></dl><h4>Slots</h4><p>header</p>',
  );
});

test("the tab's data loads in a status, and a failed load offers Try again", () => {
  assert.equal(
    renderToStaticMarkup(<PropsStatus status="loading" wording={WORDING} />),
    '<section aria-label="Props status" data-props-section="status"><p role="status">Loading props…</p></section>',
  );
  assert.equal(
    renderToStaticMarkup(<PropsStatus status="failed" wording={WORDING} />),
    '<section aria-label="Props status" data-props-section="status"><p role="alert">Props couldn’t be loaded.</p><button class="mbk-text-button" type="button">Try again</button></section>',
  );
  let retries = 0;
  render(
    <PropsStatus
      onRetry={() => (retries += 1)}
      status="failed"
      wording={WORDING}
    />,
  );
  const section = screen.getByRole("region", { name: "Props status" });
  assert.equal(
    within(section).getByRole("alert").textContent,
    "Props couldn’t be loaded.",
  );
  fireEvent.click(within(section).getByRole("button", { name: "Try again" }));
  assert.equal(retries, 1);
});
