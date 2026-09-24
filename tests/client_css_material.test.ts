import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ComparisonViews } from "../packages/viewer/dist/shell/comparison_views.js";
import { isStyleOnlyView } from "../packages/viewer/dist/shell/workspace_style_evidence.js";

import { cssSchemaFixture } from "./helpers/review_css_schema.js";

test("a material change with matched stylesheet evidence reads Screen changed", () => {
  const result = cssSchemaFixture(4);
  const view = result.screens[0]!.views[0]!;
  Object.assign(view, { material: true });

  const markup = renderToStaticMarkup(
    createElement(ComparisonViews, {
      component: false,
      loaded: { result, url: "https://example.test/review.json" },
      presentation: {
        colorScheme: "light",
        mode: "side",
        requestedColorScheme: "light",
        viewport: "mobile",
      },
      route: "screens/auth.html",
    }),
  );

  assert.match(markup, /<h3>Mobile · Screen changed<\/h3>/);
  assert.doesNotMatch(markup, /Styles this screen uses changed/);
  assert.equal(isStyleOnlyView(view), false);
});

test("an effective Light comparison retains the requested Dark fallback label", () => {
  const result = cssSchemaFixture(4);
  const markup = renderToStaticMarkup(
    createElement(ComparisonViews, {
      component: false,
      loaded: { result, url: "https://example.test/review.json" },
      presentation: {
        colorScheme: "light",
        mode: "side",
        requestedColorScheme: "dark",
        viewport: "mobile",
      },
      route: "screens/auth.html",
    }),
  );

  assert.match(markup, /<h3>Mobile · Screen changed · Light only<\/h3>/);
});
