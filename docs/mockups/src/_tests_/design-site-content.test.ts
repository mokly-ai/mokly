import assert from "node:assert/strict";
import { dirname, relative } from "node:path";
import { test } from "node:test";

import { openSource, siteStage } from "../fixtures/site";

import { screenView } from "./catalogue-paths";
import {
  attribute,
  byClass,
  elements,
  label,
  siteDocument,
  siteEntry,
  siteStyles,
} from "./design-site-test-helpers";

/** The hero's one-line heading and lead, in reading order. */
const hero = [
  "Mockup your entire app.",
  "Prevent AI slop and accidental clobbers, by codifying your design and forcing agents to align their implementation with it.",
];

const features = [
  "See every branch as screens.",
  "Comment on the screen itself.",
  "Ask for the change beside the screen.",
];

const steps = [
  "Shape the next screen.",
  "Publish the branch.",
  "Build from a shared decision.",
];

const sections = [
  "Getting started",
  "Authoring",
  "Catalogue",
  "CLI reference",
  "Continuous integration",
  "Mokly Cloud",
  "Reference",
  "Review and edit",
];

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: home carries the approved copy and real dogfood stage`, () => {
    const { document, html, route } = siteDocument(
      "design/site/home",
      viewport,
    );
    const text = label(document);
    for (const line of [...hero, ...features, ...steps])
      assert.ok(text.includes(line), `missing home copy: ${line}`);
    const intro = byClass(document, "site-hero")[0];
    assert.ok(intro);
    assert.deepEqual(
      elements(intro, (node) => ["h1", "p"].includes(node.tagName)).map(label),
      hero,
      "the hero carries only its heading and lead",
    );
    for (const actions of byClass(document, "site-actions")) {
      const links = elements(actions, (node) => node.tagName === "a");
      assert.deepEqual(links.map(label), ["Get started →", "View on GitHub"]);
      assert.equal(attribute(links[0]!, "data-mokly-link"), "design/site/docs");
      assert.equal(attribute(links[1]!, "href"), openSource.github);
    }
    assert.deepEqual(byClass(document, "site-feature-label").map(label), [
      "BROWSE",
      "REVIEW",
      "EDIT",
    ]);

    const frame = byClass(document, "site-frame")[0];
    assert.ok(frame);
    assert.equal(
      label(byClass(frame, "site-frame-head")[0]!),
      siteStage.label + siteStage.status,
    );
    const depicted = siteEntry("product/account/project-created");
    assert.equal(depicted.kind, "screen");
    if (depicted.kind !== "screen") return;
    assert.equal(
      label(byClass(frame, "site-frame-foot")[0]!),
      "Screen" + depicted.title,
    );
    assert.equal(
      label(byClass(frame, "site-screen-title")[0]!),
      depicted.title,
    );
    assert.equal(
      label(byClass(frame, "site-idchip")[0]!),
      "#product/account/project-created",
    );

    const frames = elements(frame, (node) => node.tagName === "iframe");
    assert.equal(frames.length, 2);
    for (const [index, scheme] of [
      [0, "light"],
      [1, "dark"],
    ] as const) {
      const child = frames[index]!;
      assert.equal(
        attribute(child, "sandbox"),
        "allow-same-origin allow-scripts",
      );
      assert.equal(attribute(child, "tabindex"), "-1");
      // Each frame opens the depicted screen's own document in this viewport
      // and scheme, addressed from the home document.
      assert.equal(
        attribute(child, "src"),
        relative(
          dirname(route),
          screenView("product/account/project-created", viewport, scheme),
        ),
      );
    }
    assert.doesNotMatch(
      html,
      /Pull request #|Welcome to Mokly|github\.com\/mokly-cloud/,
    );
  });

  test(`${viewport}: documentation depicts the contracted architecture`, () => {
    const { document } = siteDocument("design/site/docs", viewport);
    const text = label(document);
    for (const section of [...sections, "Changelog"])
      assert.ok(text.includes(section), `missing docs section: ${section}`);
    assert.ok(
      text.includes("npm install --save-dev @mokly/mokly react react-dom"),
    );
    assert.equal(byClass(document, "site-code-copy").map(label).join(), "Copy");
    assert.equal(byClass(document, "site-search").length, 1);
    assert.deepEqual(
      byClass(document, "site-onpage-link").map((node) =>
        attribute(node, "href"),
      ),
      [
        "#install-the-package",
        "#add-the-configuration",
        "#author-your-first-screen",
      ],
    );
    assert.equal(
      byClass(document, "site-docs-side").length,
      viewport === "desktop" ? 1 : 0,
    );
    assert.equal(
      byClass(document, "site-doc-disclosure").length,
      viewport === "mobile" ? 1 : 0,
    );
  });

  test(`${viewport}: legal documents show approved copy and navigation`, () => {
    const policies = [
      ["design/site/terms", "Terms of Service", "1. What Mokly does"],
      [
        "design/site/privacy",
        "Privacy Policy",
        "1. Controller and service role",
      ],
      ["design/site/complaints", "Complaints", "1. How to complain"],
      ["design/site/security", "Security", "1. Hosting and isolation"],
    ] as const;
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
}

test("site mockup CSS contains no parallel tokens or literal colors", () => {
  const css = siteStyles();
  assert.doesNotMatch(css, /--site-/);
  assert.doesNotMatch(css, /--mk-[\w-]+\s*:/);
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|(?:rgb|hsl)a?\(/i);
  for (const value of css.matchAll(/^\s*[\w-]+:\s*([^;]+);/gm))
    assert.doesNotMatch(
      value[1] ?? "",
      /(?<![\w-])(?:aqua|black|blue|brown|fuchsia|gold|gray|green|grey|lime|maroon|navy|olive|orange|pink|purple|red|silver|teal|violet|white|yellow)(?![\w-])/i,
    );
});
