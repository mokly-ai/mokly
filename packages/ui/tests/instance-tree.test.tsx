import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  InstanceTree,
  type InstanceNode,
} from "../src/instance-tree/instance-tree.js";

import { assertSameElement } from "./dom-assertions.js";

function node(key: string, nested: readonly InstanceNode[] = []): InstanceNode {
  return { id: `${key}-id`, key, nested, title: "Action" };
}

/** Two instances; the first holds one, which holds another. */
const INSTANCES = [node("a", [node("b", [node("c")])]), node("d")];

const VIEWPORTS = [
  { key: "desktop/light", viewport: "desktop" },
  { key: "mobile/light", viewport: "mobile" },
] as const;

type TreeProps = ComponentProps<typeof InstanceTree>;

function tree(props: Partial<TreeProps> = {}) {
  return (
    <InstanceTree
      usage={{ components: 1, instances: INSTANCES, status: "ready", total: 4 }}
      viewport="desktop"
      viewports={VIEWPORTS}
      {...props}
    />
  );
}

test("the tree keeps the shell's markup: the viewport choice, the counts, and the instances", () => {
  assert.equal(
    renderToStaticMarkup(
      tree({
        selectedKey: "d",
        usage: {
          components: 1,
          instances: [node("a", [node("b")]), node("d")],
          status: "ready",
          total: 3,
        },
      }),
    ),
    '<div class="mbk-reset"><button aria-pressed="true" class="mbk-instance-context mbk-chip mbk-reset" type="button">Desktop</button><button aria-pressed="false" class="mbk-instance-context mbk-chip mbk-reset" type="button">Mobile</button></div>' +
      '<p class="mbk-reset">3 instances · 1 component</p>' +
      '<ul class="mbk-instance-tree mbk-reset"><li class="mbk-reset"><button aria-pressed="false" class="mbk-instance-select mbk-reset" data-instance-key="a" type="button">Action · a-id</button><details class="mbk-reset"><summary class="mbk-reset">1 nested instance</summary><ul class="mbk-instance-tree mbk-reset"><li class="mbk-reset"><button aria-pressed="false" class="mbk-instance-select mbk-reset" data-instance-key="b" type="button">Action · b-id</button></li></ul></details></li>' +
      '<li class="mbk-reset"><button aria-pressed="true" class="mbk-instance-select mbk-reset" data-instance-key="d" type="button">Action · d-id</button></li></ul>',
  );
});

test("the counts take the singular for one component and one nested instance", () => {
  const { container } = render(
    tree({
      usage: {
        components: 1,
        instances: [node("a", [node("b")])],
        status: "ready",
        total: 2,
      },
    }),
  );
  assert.equal(
    container.querySelector("p")?.textContent,
    "2 instances · 1 component",
  );
  assert.equal(
    container.querySelector("summary")?.textContent,
    "1 nested instance",
  );
});

test("a static depiction's instances with addresses are links, the selected one is current, and named lists start open", () => {
  const linked = (
    key: string,
    nested: readonly InstanceNode[] = [],
  ): InstanceNode => ({ ...node(key, nested), href: `#${key}` });
  const { container } = render(
    tree({
      initiallyExpanded: ["a"],
      selectedKey: "b",
      usage: {
        components: 1,
        instances: [linked("a", [linked("b")])],
        status: "ready",
        total: 2,
      },
    }),
  );
  assert.deepEqual(
    screen
      .queryAllByRole("link")
      .map((link) => [
        link.textContent,
        link.getAttribute("href"),
        link.getAttribute("aria-current"),
        link.className,
      ]),
    [
      ["Action · a-id", "#a", null, "mbk-instance-select mbk-reset"],
      ["Action · b-id", "#b", "true", "mbk-instance-select mbk-reset"],
    ],
  );
  assert.equal(
    container.querySelectorAll("button.mbk-instance-select").length,
    0,
  );
  assert.equal(container.querySelector("details")?.open, true);
});

test("one viewport offers no choice, and a choice reports its viewport", () => {
  assert.doesNotMatch(
    renderToStaticMarkup(tree({ viewports: VIEWPORTS.slice(0, 1) })),
    /mbk-instance-context/,
  );
  const viewports: string[] = [];
  render(tree({ onViewport: (viewport) => viewports.push(viewport) }));
  fireEvent.click(
    screen.getByRole("button", { name: "Mobile", pressed: false }),
  );
  assert.deepEqual(viewports, ["mobile"]);
});

test("a view without records waits, cannot be inspected, or uses no components", () => {
  const { rerender } = render(
    tree({
      usage: { status: "waiting", text: "Waiting for the component preview." },
    }),
  );
  assert.equal(
    screen.getByRole("status").textContent,
    "Waiting for the component preview.",
  );
  rerender(tree({ usage: { status: "unavailable" } }));
  assertSameElement(screen.queryByRole("status"), null);
  assert.ok(
    screen.getByText("Component inspection is unavailable for this view."),
  );
  rerender(
    tree({
      usage: { components: 0, instances: [], status: "ready", total: 0 },
    }),
  );
  assert.ok(
    screen.getByText("No registered components are used in this view."),
  );
  assertSameElement(screen.queryByRole("list"), null);
});

test("a reader selects an instance, and the selected instance is pressed", () => {
  const selected: string[] = [];
  render(tree({ onSelect: (key) => selected.push(key), selectedKey: "a" }));
  assert.equal(
    screen
      .getByRole("button", { name: "Action · a-id" })
      .getAttribute("aria-pressed"),
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Action · d-id" }));
  assert.deepEqual(selected, ["d"]);
});

test("a nested list opens on its first instance and closes on its owner, and stays open", () => {
  const focused: string[] = [];
  const onFocus = (key: string) => focused.push(key);
  const { container, rerender } = render(tree({ onFocus }));
  const outer = container.querySelector("details");
  assert.ok(outer);
  assert.equal(
    outer.querySelector("summary")?.textContent,
    "1 nested instance",
  );
  // A toggle that agrees with the shown state reports nothing.
  fireEvent(outer, new Event("toggle"));
  assert.deepEqual(focused, []);
  // happy-dom fires the toggle event as soon as `open` changes. Each change
  // settles in act, as a browser renders between two toggles.
  act(() => {
    outer.open = true;
  });
  assert.deepEqual(focused, ["b"]);
  const inner = outer.querySelector("ul details");
  assert.ok(inner instanceof HTMLDetailsElement);
  // The inner list's toggle also reaches the outer list, which is open
  // already and so reports nothing.
  act(() => {
    inner.open = true;
  });
  assert.deepEqual(focused, ["b", "c"]);
  rerender(tree({ onFocus, selectedKey: "c" }));
  assert.equal(outer.open, true);
  assert.equal(inner.open, true);
  act(() => {
    outer.open = false;
  });
  assert.deepEqual(focused, ["b", "c", "a"]);
});
