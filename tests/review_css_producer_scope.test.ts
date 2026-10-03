import assert from "node:assert/strict";
import test from "node:test";

import { MoklyError } from "../dist/errors.js";
import { classifyComponents } from "../dist/review/component_classification.js";
import type { ResourceEvidence } from "../dist/review/css/resource_analysis.js";
import { ResourceComparison } from "../dist/review/resource_comparison.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

test("v5 asserts analysed reason scope at the producer boundary", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const config = {
    ...fixture.config,
    sourceFiles: [...(fixture.config.sourceFiles ?? []), "mockups/private.css"],
  };
  const documents = new Map(
    [...fixture.after.outputs].map(([route, html]) => [
      route,
      Buffer.from(html),
    ]),
  );
  const reader = {
    read: async (route: string) => {
      const document = documents.get(route);
      assert.ok(document, `Unexpected document read: ${route}`);
      return document;
    },
  };
  for (const [resource, analysed, valid] of [
    ["src/styles/tokens.css", true, false],
    ["mockups/private.css", true, false],
    ["mockups/image.svg", true, false],
    ["mockups/shared.css", true, true],
    ["src/styles/tokens.css", false, true],
  ] as const)
    await t.test(`${resource}, analysis ${analysed}`, async (context) => {
      const evidence: ResourceEvidence = {
        reasons: [
          {
            kind: "dependency",
            path: resource,
            ...(analysed
              ? {
                  analysis: {
                    status: "matched" as const,
                    selectors: [".auth"],
                  },
                }
              : {}),
          },
        ],
      };
      context.mock.method(
        ResourceComparison.prototype,
        "compare",
        async () => evidence,
      );
      const compare = () =>
        classifyComponents({
          before: fixture.before.manifest,
          after: fixture.after.manifest,
          beforeReader: reader,
          afterReader: reader,
          config,
          changedPaths: [resource],
          baseCommit: "a".repeat(40),
          baseRef: "main",
          useFastPath: false,
        });
      if (valid) await assert.doesNotReject(compare);
      else
        await assert.rejects(compare, (error: unknown) => {
          assert.ok(error instanceof MoklyError);
          assert.equal(error.code, "review-invalid");
          assert.ok(error.message.includes(resource));
          return true;
        });
    });
});
