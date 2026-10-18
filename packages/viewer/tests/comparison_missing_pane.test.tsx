import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { ViewRouteKind } from "../src/navigation/routes.js";
import type { ReviewView } from "../src/review/types.js";
import type { ComparisonScrollSync } from "../src/shell/comparison_scroll_types.js";
import { SideBySideComparison } from "../src/shell/comparison_side.js";
import { ComparisonViews } from "../src/shell/comparison_views.js";
import { entryWording } from "../src/shell/entry_wording.js";
import type { ComparisonPresentation } from "../src/shell/use_comparison.js";

/** The messages of a Side by side comparison with neither document present. */
function missingMessages(kind: ViewRouteKind): string[] {
  const markup = renderToStaticMarkup(
    <SideBySideComparison
      chrome={(node) => node}
      documents={{}}
      sync={{} as ComparisonScrollSync}
      view={{} as ReviewView}
      wording={entryWording(kind)}
    />,
  );
  return [...markup.matchAll(/<p class="mb-pane-missing">([^<]*)<\/p>/g)].map(
    (match) => match[1]!,
  );
}

/** The message of a comparison whose review has no record for the entry. */
function unavailableMessage(kind: ViewRouteKind): string {
  return renderToStaticMarkup(
    <ComparisonViews
      entryId="entry"
      entryKind={kind}
      presentation={{} as ComparisonPresentation}
      presentations={new Map()}
      together
      views={undefined}
    />,
  );
}

test("a missing pane names a removed or added component variant, not a screen", () => {
  assert.deepEqual(missingMessages("component"), [
    "This variant was added on this branch.",
    "This variant was removed on this branch.",
  ]);
  assert.deepEqual(missingMessages("screen"), [
    "This screen was added on this branch.",
    "This screen was removed on this branch.",
  ]);
});

test("a component without a review record does not call itself a screen", () => {
  assert.equal(
    unavailableMessage("component"),
    "<p>This variant has no comparison available.</p>",
  );
  assert.equal(
    unavailableMessage("screen"),
    "<p>This screen has no comparison available.</p>",
  );
});
