import assert from "node:assert/strict";
import { test } from "node:test";

import {
  blurSuggestedSlug,
  createSuggestedSlugValues,
  createRequestSequence,
  editSuggestedSlug,
  focusSuggestedSlug,
  suggestedSlugValue,
  updateAutomaticSlug,
} from "../data/use-slug-suggestion";

test("a late suggestion cannot replace the newest request", () => {
  const sequence = createRequestSequence();
  const first = sequence.next();
  const second = sequence.next();
  assert.equal(first(), false);
  assert.equal(second(), true);
  sequence.invalidate();
  assert.equal(second(), false);
});

test("a queued automatic value stays behind the focused DOM snapshot", () => {
  let values = updateAutomaticSlug(createSuggestedSlugValues(), "first");
  values = updateAutomaticSlug(values, "second");
  values = focusSuggestedSlug(values, "first");
  values = updateAutomaticSlug(values, "third");
  assert.equal(suggestedSlugValue(values), "first");

  values = editSuggestedSlug(values, "chosen-by-reader");
  values = blurSuggestedSlug(values);
  assert.equal(suggestedSlugValue(values), "chosen-by-reader");
});

test("an untouched field accepts its latest suggestion after blur", () => {
  let values = updateAutomaticSlug(createSuggestedSlugValues(), "first");
  values = focusSuggestedSlug(values, "first");
  values = updateAutomaticSlug(values, "second");
  assert.equal(suggestedSlugValue(values), "first");
  values = blurSuggestedSlug(values);
  assert.equal(suggestedSlugValue(values), "second");
});

test("an empty manual value remains manually owned", () => {
  let values = updateAutomaticSlug(createSuggestedSlugValues(), "automatic");
  values = focusSuggestedSlug(values, "automatic");
  values = editSuggestedSlug(values, "");
  values = updateAutomaticSlug(values, "later");
  values = blurSuggestedSlug(values);
  assert.equal(suggestedSlugValue(values), "");
});
