import assert from "node:assert/strict";
import test from "node:test";

import { defineUseCase } from "../dist/authoring/definitions.js";
import type { ResolvedRegistryEntry } from "../dist/authoring/types.js";
import { rewriteMockLinks } from "../dist/build/mock_links.js";

test("logical links reject a use case without a screen first step", () => {
  const useCase = defineUseCase({
    description: "No first step",
    path: "empty-flow",
    relatedDocs: [],
    steps: [],
    title: "Empty flow",
  }) as ResolvedRegistryEntry;
  assert.throws(
    () =>
      rewriteMockLinks(
        '<a href="mock:empty-flow">Flow</a>',
        "home/index.mobile.html",
        "mobile",
        "light",
        new Map([[useCase.path, useCase]]),
        ["light"],
      ),
    /use case empty-flow has no screen as its first step/,
  );
});
