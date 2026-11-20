import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { DropdownList } from "@firna/ui/dropdown";
import { Textarea } from "@firna/ui/input";
import { List, ListItem } from "@firna/ui/list";
import { WebModalFrame } from "@firna/ui/modal";
import { SegmentedControl } from "@firna/ui/segmented";
import { SkeletonGroup } from "@firna/ui/skeleton";
import { Switch } from "@firna/ui/switch";
import { createElement, isValidElement } from "react";
import type { ElementType, ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { contentListInput } from "../components/content-list";
import { optionsListInput } from "../components/options-list";
import { segmentedInput } from "../components/segmented";
import { skeletonInput } from "../components/skeleton";
import { switchInput } from "../components/switch";
import { textareaInput } from "../components/textarea";

import { wrapperMarkup } from "./wrapper-markup";

const context = { viewport: "mobile", colorScheme: "dark" } as const;

/**
 * The props that Mokly renders for a component's first saved variant: the
 * variant's props laid over the component's own props.
 */
function firstVariantProps<P>(input: {
  props?: P;
  variants?: readonly { props: Partial<P> }[];
}): P {
  const [variant] = input.variants ?? [];
  assert.ok(input.props !== undefined && variant !== undefined);
  return { ...input.props, ...variant.props };
}
function contains(node: ReactNode, type: ElementType): boolean {
  if (Array.isArray(node)) return node.some((child) => contains(child, type));
  return (
    isValidElement<{ children?: ReactNode }>(node) &&
    (node.type === type || contains(node.props.children, type))
  );
}

test("new registered controls render actual public Firna components", () => {
  const cases: [ReactNode, ElementType][] = [
    [textareaInput.render({ label: "Comment" }, context), Textarea],
    [
      segmentedInput.render(firstVariantProps(segmentedInput), context),
      SegmentedControl,
    ],
    [
      switchInput.render({ label: "Require approval", value: true }, context),
      Switch,
    ],
    [
      optionsListInput.render(firstVariantProps(optionsListInput), context),
      DropdownList,
    ],
    [
      skeletonInput.render(firstVariantProps(skeletonInput), context),
      SkeletonGroup,
    ],
    [
      contentListInput.render(firstVariantProps(contentListInput), context),
      List,
    ],
  ];
  for (const [node, component] of cases) {
    assert.ok(contains(node, component));
    assert.equal(
      contains(createElement("div", { "data-testid": "firna" }), component),
      false,
    );
  }
  const list = contentListInput.render(
    firstVariantProps(contentListInput),
    context,
  );
  assert.ok(
    isValidElement<{
      renderItem: (row: { id: string; title: string }) => ReactElement;
    }>(list),
  );
  assert.ok(
    contains(list.props.renderItem({ id: "one", title: "One" }), ListItem),
  );
});

test("static textarea preserves its label, draft, error and no-op change contract", (t) => {
  const warnings = t.mock.method(console, "error", () => {});
  const html = wrapperMarkup(
    textareaInput.render(
      {
        label: "Comment",
        value: "Retained draft",
        error: "Comment couldn’t be posted. Try again.",
      },
      context,
    ),
    context,
  );
  assert.match(html, /<textarea[^>]+aria-labelledby="[^"]+-label"/);
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /aria-errormessage="[^"]+-error"/);
  assert.match(html, /Retained draft<\/textarea>/);
  assert.equal(warnings.mock.callCount(), 0);
});

test("the public Firna modal has no server-rendered body, requiring the documented static layout", () => {
  const html = renderToStaticMarkup(
    createElement(
      WebModalFrame,
      { title: "Share publication", visible: true, onClose() {} },
      "Modal body",
    ),
  );
  assert.equal(html, "");
  assert.match(
    readFileSync(
      new URL("../../../protocol/cloud/shared-controls.md", import.meta.url),
      "utf8",
    ),
    /static-only|Static Product Overlays/,
  );
});
