import assert from "node:assert/strict";
import { test } from "node:test";

import {
  attribute,
  byClass,
  elements,
  label,
  siteDocument,
} from "./design-site-test-helpers";

/** Each legal document: its screen, title, first section and source file. */
const policies = [
  [
    "design/site/terms",
    "Terms of Service",
    "1. What Mokly does",
    "legal/terms.md",
  ],
  [
    "design/site/privacy",
    "Privacy Policy",
    "1. Controller and service role",
    "legal/privacy.md",
  ],
  [
    "design/site/complaints",
    "Complaints",
    "1. How to complain",
    "legal/complaints.md",
  ],
  [
    "design/site/security",
    "Security",
    "1. Hosting and isolation",
    "legal/security.md",
  ],
] as const;

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: legal documents show approved copy and navigation`, () => {
    const policyIds = policies.map(([id]) => id);
    for (const [id, title, firstSection] of policies) {
      const { document } = siteDocument(id, viewport);
      const body = byClass(document, "site-policy-body")[0];
      assert.ok(body);
      assert.equal(
        label(elements(document, (node) => node.tagName === "h1")[0]!),
        title,
      );
      assert.equal(
        label(elements(body, (node) => node.tagName === "h2")[0]!),
        firstSection,
      );
      const time = elements(document, (node) => node.tagName === "time")[0];
      assert.ok(time);
      assert.equal(attribute(time, "datetime"), "2026-09-22");
      assert.equal(label(time), "22 September 2026");
      assert.deepEqual(
        elements(
          byClass(document, "site-policy-links")[0]!,
          (node) => node.tagName === "a",
        )
          .map((node) => attribute(node, "data-mokly-link"))
          .sort(),
        policyIds.filter((policyId) => policyId !== id).sort(),
      );
    }
  });

  test(`${viewport}: each legal document is a page frame labelled with its source file`, () => {
    for (const [id, , , file] of policies) {
      const { document } = siteDocument(id, viewport);
      const main = elements(document, (node) => node.tagName === "main")[0];
      assert.ok(main, id);
      const frames = byClass(main, "site-page-frame");
      assert.equal(frames.length, 1, id);
      const frame = frames[0]!;
      const name = byClass(frame, "site-frame-name")[0];
      assert.ok(name, id);
      assert.equal(label(name), file);
      assert.equal(attribute(name, "aria-hidden"), "true", id);
      const selection = byClass(frame, "site-sel")[0];
      assert.ok(selection, id);
      assert.equal(attribute(selection, "aria-hidden"), "true", id);
      assert.deepEqual(
        byClass(selection, "site-sel-handle").map((node) =>
          attribute(node, "class"),
        ),
        [
          "site-sel-handle site-sel-handle--nw",
          "site-sel-handle site-sel-handle--ne",
          "site-sel-handle site-sel-handle--se",
          "site-sel-handle site-sel-handle--sw",
        ],
        id,
      );
      const sheet = byClass(frame, "site-page-sheet")[0];
      assert.ok(sheet, id);
      for (const part of [
        "site-document-intro",
        "site-policy-body",
        "site-policy-links",
      ])
        assert.equal(byClass(sheet, part).length, 1, `${id}: ${part}`);
    }
  });
}
