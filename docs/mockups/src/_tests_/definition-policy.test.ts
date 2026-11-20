import assert from "node:assert/strict";
import { test } from "node:test";

import { createElement } from "react";

import {
  FixtureState,
  fixtureCatalogue,
  fixtureComponent,
} from "./definition-fixtures";
import { definitionViolations } from "./definition-policy";
import type { CatalogueDefinition } from "./load-catalogue";

type Mutation = [string, (entries: CatalogueDefinition[]) => void];

/** Each mutation of a fresh fixture copy yields a problem with its message. */
function rejects(
  fixture: () => CatalogueDefinition[],
  mutations: readonly Mutation[],
): void {
  assert.deepEqual(definitionViolations(fixture()), []);
  for (const [message, mutation] of mutations) {
    const entries = fixture();
    mutation(entries);
    assert.ok(
      definitionViolations(entries).some((problem) =>
        problem.startsWith(message),
      ),
      message,
    );
  }
}

test("screen variants share their parent's render with props that draw their own component", () => {
  rejects(fixtureCatalogue, [
    [
      "screen component reused as a different screen",
      (entries) => Object.assign(entries[1], { props: { state: "default" } }),
    ],
    [
      "variant shares its parent's render",
      (entries) =>
        Object.assign(entries[1], {
          render: () => createElement(FixtureState),
        }),
    ],
    [
      "variant sets its own props",
      (entries) => Object.assign(entries[1], { props: undefined }),
    ],
  ]);
});

test("no definition declares the dependencies that Mokly derives from imports", () => {
  rejects(fixtureCatalogue, [
    [
      "no declared dependencies",
      (entries) => Object.assign(entries[0], { dependencies: [] }),
    ],
  ]);
  rejects(fixtureComponent, [
    [
      "no declared dependencies",
      (entries) => Object.assign(entries[0], { ownedDependencies: [] }),
    ],
  ]);
});

test("registered components declare closed prop schemas, their own props and the slots their variants fill", () => {
  const open = {
    type: "object",
    properties: { label: { type: "string" } },
  };
  const nested = {
    type: "object",
    additionalProperties: false,
    properties: { rows: { type: "array", items: { type: "object" } } },
  };
  rejects(fixtureComponent, [
    [
      "closed prop schema",
      (entries) => Object.assign(entries[0], { propSchema: open }),
    ],
    [
      "closed prop schema",
      (entries) => Object.assign(entries[0], { propSchema: nested }),
    ],
    [
      "own props required",
      (entries) => Object.assign(entries[0], { props: undefined }),
    ],
    [
      "declared slots only",
      (entries) => Object.assign(entries[1], { slots: { footer: "Extra" } }),
    ],
  ]);
});
