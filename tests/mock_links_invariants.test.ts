import assert from "node:assert/strict";
import test from "node:test";

import { defineUseCase } from "../dist/authoring/definitions.js";
import type { ResolvedRegistryEntry } from "../dist/authoring/types.js";
import { rewriteMockLinks } from "../dist/build/mock_links.js";

test("logical links reject a use case without a screen first step", () => {
  const useCase = defineUseCase({
    dependencies: [],
    description: "No first step",
    id: "empty-flow",
    relatedDocs: [],
    route: "user-flows/empty-flow.html",
    steps: [],
    title: "Empty flow",
  }) as ResolvedRegistryEntry;
  assert.throws(
    () =>
      rewriteMockLinks(
        '<a href="mock:empty-flow">Flow</a>',
        "screens/home.mobile.html",
        "mobile",
        "light",
        new Map([[useCase.id, useCase]]),
        ["light"],
      ),
    /use case empty-flow has no screen as its first step/,
  );
});
