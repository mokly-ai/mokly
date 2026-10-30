import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";

import { ComparisonEvidence } from "../src/comparison-evidence/comparison-evidence.js";
import { ComparisonHeading } from "../src/comparison-evidence/evidence-files.js";

const HEADING = "<h3>Comparison details</h3>";

const FILES = {
  lead: "Changes to these files may affect this component:",
  stylesheets: [
    {
      path: "styles/a.css",
      outcomes: [
        {
          lead: "Changed styles that apply to this component:",
          selectors: [".a", ".z"],
        },
        { lead: "Changed styles that apply to this variant.", selectors: [] },
      ],
    },
    { path: "styles/c.css", outcomes: [] },
  ],
};

const EXCLUDED = {
  paths: ["styles/x.css", "styles/y.css"],
  sentence:
    "These stylesheets changed, but none of the changed styles apply to this variant.",
};

test("the shared heading names only a known branch point", () => {
  for (const base of ["", " "])
    assert.equal(
      renderToStaticMarkup(<ComparisonHeading base={base} />),
      HEADING,
    );
  assert.equal(
    renderToStaticMarkup(<ComparisonHeading base="origin/main" />),
    `${HEADING}<p>Compared with the branch point on origin/main.</p>`,
  );
});

test("a hidden section holds nothing until facts are known", () => {
  assert.equal(
    renderToStaticMarkup(
      <ComparisonEvidence
        base="main"
        hidden
        mark="data-workspace-evidence"
        reasons={[{ key: "material/0", text: "Rendered content changed." }]}
      />,
    ),
    '<section class="mbk-comparison-evidence" data-workspace-evidence="" hidden=""></section>',
  );
});

test("the facts follow the designs' order with the shell's text nodes", () => {
  const markup = renderToString(
    <ComparisonEvidence
      base="main"
      changedComponents={[
        {
          href: "/view/components/action/",
          key: "components/action",
          title: "Action",
        },
      ]}
      excluded={EXCLUDED}
      files={FILES}
      hidden={false}
      ignored={["clock", "ad"]}
      inputChanges={[
        {
          after: '{"label": "Get started"}',
          before: '{"label": "Go"}',
          colorScheme: "light",
          instanceId: "footer",
          key: "footer/desktop/light",
          title: "Action",
          viewport: "desktop",
        },
      ]}
      mark="data-workspace-evidence"
      noChanges="No changes to this variant."
      previousPath="old/place"
      reasons={[
        { key: "added/0", text: "Added to this branch." },
        { key: "material/2", text: "Rendered content changed." },
      ]}
      savedProps={{ after: '{"a": 2}', before: '{"a": 1}' }}
      sharedImpact="Changed components that this variant uses affect its preview."
    />,
  );
  assert.equal(
    markup,
    '<section class="mbk-comparison-evidence" data-workspace-evidence="">' +
      `${HEADING}<p>Compared with the branch point on <!-- -->main<!-- -->.</p>` +
      '<p>The previous version is at<!-- --> <code class="mbk-code">old/place</code>, where it was before the move.</p>' +
      "<p>Added to this branch.</p><p>Rendered content changed.</p>" +
      "<p>Changes to these files may affect this component:</p>" +
      '<ul class="mbk-evidence-files"><li>styles/a.css<p>Changed styles that apply to this component:</p><ul><li><code class="mbk-code">.a</code></li><li><code class="mbk-code">.z</code></li></ul><p>Changed styles that apply to this variant.</p></li><li>styles/c.css</li></ul>' +
      "<p>These stylesheets changed, but none of the changed styles apply to this variant.</p><p>Examined and excluded:</p><ul><li>styles/x.css</li><li>styles/y.css</li></ul>" +
      "<h3>Action<!-- --> · <!-- -->footer<!-- --> · <!-- -->desktop<!-- --> ·<!-- --> <!-- -->light</h3><p>Before</p><pre>{&quot;label&quot;: &quot;Go&quot;}</pre><p>Current</p><pre>{&quot;label&quot;: &quot;Get started&quot;}</pre>" +
      '<p>Changed component:<!-- --> <a href="/view/components/action/">Action</a></p>' +
      "<p>Excluded content: <!-- -->clock, ad<!-- -->.</p>" +
      "<p>Changed components that this variant uses affect its preview.</p>" +
      "<h3>Saved props changed</h3><p>Before</p><pre>{&quot;a&quot;: 1}</pre><p>Current</p><pre>{&quot;a&quot;: 2}</pre>" +
      "<p>No changes to this variant.</p></section>",
  );
});

test("a page's evidence is the heading, its files, its exclusions, and its terminal line", () => {
  assert.equal(
    renderToStaticMarkup(
      <ComparisonEvidence
        base=""
        excluded={{
          paths: ["mockups/page.css"],
          sentence:
            "This stylesheet changed, but none of the changed styles apply to this page.",
        }}
        mark="data-page-evidence"
        noChanges="No changes to this page."
      />,
    ),
    `<section class="mbk-comparison-evidence" data-page-evidence="">${HEADING}<p>This stylesheet changed, but none of the changed styles apply to this page.</p><p>Examined and excluded:</p><ul><li>mockups/page.css</li></ul><p>No changes to this page.</p></section>`,
  );
});

test("files and exclusions without entries draw nothing", () => {
  assert.equal(
    renderToStaticMarkup(
      <ComparisonEvidence
        base=""
        excluded={{ paths: [], sentence: "unused" }}
        files={{ lead: "unused", stylesheets: [] }}
        mark="data-page-evidence"
      />,
    ),
    `<section class="mbk-comparison-evidence" data-page-evidence="">${HEADING}</section>`,
  );
});

test("each changed component links to its page", () => {
  render(
    <ComparisonEvidence
      base="main"
      changedComponents={[
        { href: "/view/components/action/", key: "a", title: "Action" },
        { href: "/view/components/badge/", key: "b", title: "Badge" },
      ]}
      mark="data-workspace-evidence"
    />,
  );
  assert.deepEqual(
    screen
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("href")]),
    [
      ["Action", "/view/components/action/"],
      ["Badge", "/view/components/badge/"],
    ],
  );
  assert.equal(
    screen.getByRole("heading", { name: "Comparison details" }).tagName,
    "H3",
  );
});
