import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";

import { ComparisonEvidence } from "../src/comparison-evidence/comparison-evidence.js";
import { ComparisonHeading } from "../src/comparison-evidence/evidence-files.js";

const HEADING = '<h3 class="mbk-reset">Comparison details</h3>';

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
    `${HEADING}<p class="mbk-reset">Compared with the branch point on origin/main.</p>`,
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
    '<section class="mbk-comparison-evidence mbk-reset" data-workspace-evidence="" hidden=""></section>',
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
    '<section class="mbk-comparison-evidence mbk-reset" data-workspace-evidence="">' +
      `${HEADING}<p class="mbk-reset">Compared with the branch point on <!-- -->main<!-- -->.</p>` +
      '<p class="mbk-reset">The previous version is at<!-- --> <code class="mbk-code mbk-reset">old/place</code>, where it was before the move.</p>' +
      '<p class="mbk-reset">Added to this branch.</p><p class="mbk-reset">Rendered content changed.</p>' +
      '<p class="mbk-reset">Changes to these files may affect this component:</p>' +
      '<ul class="mbk-evidence-files mbk-reset"><li class="mbk-reset">styles/a.css<p class="mbk-reset">Changed styles that apply to this component:</p><ul class="mbk-reset"><li class="mbk-reset"><code class="mbk-code mbk-reset">.a</code></li><li class="mbk-reset"><code class="mbk-code mbk-reset">.z</code></li></ul><p class="mbk-reset">Changed styles that apply to this variant.</p></li><li class="mbk-reset">styles/c.css</li></ul>' +
      '<p class="mbk-reset">These stylesheets changed, but none of the changed styles apply to this variant.</p><p class="mbk-reset">Examined and excluded:</p><ul class="mbk-reset"><li class="mbk-reset">styles/x.css</li><li class="mbk-reset">styles/y.css</li></ul>' +
      '<h3 class="mbk-reset">Action<!-- --> · <!-- -->footer<!-- --> · <!-- -->desktop<!-- --> ·<!-- --> <!-- -->light</h3><p class="mbk-reset">Before</p><pre class="mbk-reset">{&quot;label&quot;: &quot;Go&quot;}</pre><p class="mbk-reset">Current</p><pre class="mbk-reset">{&quot;label&quot;: &quot;Get started&quot;}</pre>' +
      '<p class="mbk-reset">Changed component:<!-- --> <a class="mbk-reset" href="/view/components/action/">Action</a></p>' +
      '<p class="mbk-reset">Excluded content: <!-- -->clock, ad<!-- -->.</p>' +
      '<p class="mbk-reset">Changed components that this variant uses affect its preview.</p>' +
      '<h3 class="mbk-reset">Saved props changed</h3><p class="mbk-reset">Before</p><pre class="mbk-reset">{&quot;a&quot;: 1}</pre><p class="mbk-reset">Current</p><pre class="mbk-reset">{&quot;a&quot;: 2}</pre>' +
      '<p class="mbk-reset">No changes to this variant.</p></section>',
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
    `<section class="mbk-comparison-evidence mbk-reset" data-page-evidence="">${HEADING}<p class="mbk-reset">This stylesheet changed, but none of the changed styles apply to this page.</p><p class="mbk-reset">Examined and excluded:</p><ul class="mbk-reset"><li class="mbk-reset">mockups/page.css</li></ul><p class="mbk-reset">No changes to this page.</p></section>`,
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
    `<section class="mbk-comparison-evidence mbk-reset" data-page-evidence="">${HEADING}</section>`,
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
