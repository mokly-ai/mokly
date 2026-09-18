import assert from "node:assert/strict";
import test from "node:test";

import { renderDiff } from "../packages/viewer/dist/client/diff_views.js";
import { isStyleOnlyView } from "../packages/viewer/dist/client/style_evidence.js";

import {
  FakeMarkupDocument,
  FakeMarkupElement,
} from "./helpers/fake_markup.js";
import { cssSchemaFixture } from "./helpers/review_css_schema.js";

test("a material change with matched stylesheet evidence reads Screen changed", () => {
  const result = cssSchemaFixture(2);
  const view = result.screens[0]!.views[0]!;
  Object.assign(view, { material: true });
  const document = new DiffDocument();
  const stage = document.createElement("main");
  renderDiff(
    document as unknown as Document,
    stage as unknown as HTMLElement,
    { result, url: "https://example.test/review.json" },
    "screens/auth.html",
    "side",
  );
  assert.equal(
    stage.children[0]!.children[0]!.textContent,
    "Mobile · Screen changed",
  );
  assert.equal(isStyleOnlyView(view), false);
});

class DiffElement extends FakeMarkupElement {
  readonly dataset: Record<string, string> = {};
  setAttribute(): void {}
}

class DiffDocument extends FakeMarkupDocument {
  readonly body = { getAttribute: () => "light" };
  override createElement(tag: string): DiffElement {
    return new DiffElement(tag, this);
  }
  querySelector(): null {
    return null;
  }
}
