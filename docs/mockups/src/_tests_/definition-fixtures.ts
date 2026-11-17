/**
 * Small valid definitions in the shape that `load-catalogue.ts` gives the
 * source policies: a screen with one state variant and a flow through it,
 * and a registered component with one saved variant. Each rejection case
 * changes one field of a fresh copy.
 */

import { defineComponent, defineScreen, defineUseCase } from "@mokly/mokly";
import { createElement } from "react";

import type { CatalogueDefinition } from "./load-catalogue";

export const fixtureMetadata = {
  title: "Fixture",
  description: "Policy fixture",
  relatedDocs: [],
};

export function FixtureScreen() {
  return createElement("main", null, "Fixture");
}

export function FixtureState() {
  return createElement("main", null, "State");
}

/** A screen variant as the loader flattens it: its authored fields and its path. */
export function fixtureState(slug: string): CatalogueDefinition {
  return {
    kind: "screen",
    slug,
    title: "Fixture state",
    description: "Policy fixture state",
    props: { state: slug },
    path: "product/screen/" + slug,
    variantOf: "product/screen",
  };
}

/**
 * `product/screen`, which draws `FixtureScreen` and its `empty` state
 * `FixtureState`, and `flows/journey`, which steps through it twice.
 */
export function fixtureCatalogue(): CatalogueDefinition[] {
  const screen = defineScreen({
    ...fixtureMetadata,
    props: { state: "default" },
    render: ({ state }) =>
      createElement(state === "empty" ? FixtureState : FixtureScreen),
    useCasePaths: ["flows/journey"],
    variants: [
      {
        slug: "empty",
        title: "Fixture state",
        description: "Policy fixture state",
        props: { state: "empty" },
      },
    ],
  });
  return [
    { ...screen, path: "product/screen" },
    fixtureState("empty"),
    {
      ...defineUseCase({
        ...fixtureMetadata,
        steps: [
          { screenPath: "product/screen" },
          { screenPath: "product/screen" },
        ],
      }),
      path: "flows/journey",
    },
  ];
}

/** `design/fixture`, with a `children` slot, and its saved variant `filled`. */
export function fixtureComponent(): CatalogueDefinition[] {
  const registration = defineComponent({
    ...fixtureMetadata,
    propSchema: {
      type: "object",
      additionalProperties: false,
      required: ["label"],
      properties: { label: { type: "string" } },
    } as const,
    props: { label: "Fixture" },
    slots: ["children"] as const,
    render: ({ label, children }) =>
      createElement("div", null, label, children),
  });
  return [
    { ...registration, path: "design/fixture" },
    {
      kind: "component",
      slug: "filled",
      title: "Filled",
      props: { label: "Filled" },
      slots: { children: "Child" },
      path: "design/fixture/filled",
      variantOf: "design/fixture",
    },
  ];
}
