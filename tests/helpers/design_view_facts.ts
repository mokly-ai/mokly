import { isDeepStrictEqual } from "node:util";

import {
  accessibleName,
  isHidden,
  withAncestors,
} from "./design_accessibility.js";
import { viewFacts } from "./design_expectations.js";
import { attribute, type HtmlElement } from "./html.js";
import type { ServedCatalogue } from "./served_design.js";

type ElementWithAncestors = [HtmlElement, readonly HtmlElement[]];

function hasClass(element: HtmlElement, name: string): boolean {
  return (attribute(element, "class") ?? "").split(/\s+/u).includes(name);
}

function isPropsAlert(element: HtmlElement | undefined): boolean {
  return (
    element !== undefined &&
    attribute(element, "role") === "alert" &&
    hasClass(element, "mbk-control-alert")
  );
}

function alertBodies(elements: readonly ElementWithAncestors[]): string[] {
  return elements
    .filter(
      ([element, [parent]]) =>
        element.tagName === "p" &&
        (isPropsAlert(element) || isPropsAlert(parent)),
    )
    .map(([element]) => accessibleName(element));
}

function labelValues(elements: readonly ElementWithAncestors[]) {
  const labelled = new Set(
    elements
      .filter(
        ([element]) =>
          element.tagName === "label" && accessibleName(element) === "Label",
      )
      .map(([element]) => attribute(element, "for")),
  );
  return elements
    .filter(([element]) => {
      const id = attribute(element, "id");
      return element.tagName === "input" && id && labelled.has(id);
    })
    .map(([element]) => attribute(element, "value"));
}

function previewLabels(
  elements: readonly ElementWithAncestors[],
  frame: string,
): string[] {
  return elements
    .filter(
      ([element, ancestors]) =>
        hasClass(element, "mbk-shot-action") &&
        ancestors.some((node) => attribute(node, "data-cv-frame") === frame),
    )
    .map(([element]) => accessibleName(element));
}

function detailsRows(elements: readonly ElementWithAncestors[]) {
  return elements.flatMap(([row, ancestors]) => {
    if (
      !hasClass(row, "mbk-meta-row") ||
      !ancestors.some(
        (node) =>
          node.tagName === "section" &&
          attribute(node, "aria-label") === "Details",
      )
    )
      return [];
    const cells = row.childNodes.filter(
      (node): node is HtmlElement => "tagName" in node,
    );
    const label = cells.find((cell) => hasClass(cell, "mbk-meta-k"));
    const value = cells.find((cell) => hasClass(cell, "mbk-meta-v"));
    return label === undefined
      ? []
      : [
          {
            label: accessibleName(label),
            value: value === undefined ? undefined : accessibleName(value),
          },
        ];
  });
}

export function viewFactViolations(catalogue: ServedCatalogue): string[] {
  const violations: string[] = [];
  for (const fact of viewFacts) {
    const views = catalogue.views.filter((view) => view.path === fact.path);
    if (views.length === 0) violations.push(`${fact.path}: no view`);
    for (const view of views) {
      const elements = [...withAncestors(view.document)].filter(
        ([element, ancestors]) => !isHidden(element, ancestors),
      );
      const check = (name: string, actual: unknown, expected: unknown) => {
        if (!isDeepStrictEqual(actual, expected))
          violations.push(
            `${view.route}: ${name} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
          );
      };
      if ("alert" in fact) {
        check("Props alert", alertBodies(elements), [fact.alert]);
      } else if ("label" in fact) {
        check("Label field", labelValues(elements), [fact.label]);
        for (const frame of ["default-light", "default-dark"])
          check(`${frame} preview`, previewLabels(elements, frame), [
            fact.defaultPreview,
          ]);
      } else {
        const rows = detailsRows(elements);
        check(
          "Story row",
          rows.filter((row) => row.label === "Story").map((row) => row.value),
          [fact.story],
        );
        check(
          "Storybook row count",
          rows.filter((row) => row.label === "Storybook").length,
          fact.storybook ? 1 : 0,
        );
      }
    }
  }
  return violations;
}
