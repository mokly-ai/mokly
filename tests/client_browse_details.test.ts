import assert from "node:assert/strict";
import test from "node:test";

import {
  DetailsDisclosurePreference,
  type DetailsPreferenceStorage,
} from "../packages/viewer/dist/client/browse_details.js";

test("details preference restores and updates explicit disclosure", () => {
  const storage = new FakeStorage("closed");
  const preference = new DetailsDisclosurePreference(storage);
  const first = { open: true } as HTMLDetailsElement;
  preference.apply(fakeDocument(first));
  assert.equal(first.open, false);

  preference.remember(true);
  assert.equal(storage.value, "open");
  const second = { open: false } as HTMLDetailsElement;
  preference.apply(fakeDocument(second));
  assert.equal(second.open, true);
});

test("details preference keeps its in-memory state without storage", () => {
  const preference = new DetailsDisclosurePreference(new FailingStorage());
  const initial = { open: true } as HTMLDetailsElement;
  preference.apply(fakeDocument(initial));
  assert.equal(initial.open, true);

  preference.remember(false);
  const replacement = { open: true } as HTMLDetailsElement;
  preference.apply(fakeDocument(replacement));
  assert.equal(replacement.open, false);
});

test("details preference records a completed activation before later tasks", async () => {
  const storage = new FakeStorage("closed");
  const preference = new DetailsDisclosurePreference(storage);
  const details = { open: false } as HTMLDetailsElement;

  preference.rememberActivation(details);
  details.open = true;
  await Promise.resolve();

  assert.equal(storage.value, "open");
});

function fakeDocument(details: HTMLDetailsElement): Document {
  return {
    querySelector(selector: string) {
      assert.equal(selector, "[data-mokly-details]");
      return details;
    },
  } as unknown as Document;
}

class FakeStorage implements DetailsPreferenceStorage {
  key: string | undefined;

  constructor(public value: string | null) {}

  getItem(key: string): string | null {
    this.key = key;
    return this.value;
  }

  setItem(key: string, value: string): void {
    assert.equal(key, this.key);
    this.value = value;
  }
}

class FailingStorage implements DetailsPreferenceStorage {
  getItem(): string | null {
    throw new Error("storage unavailable");
  }

  setItem(): void {
    throw new Error("storage unavailable");
  }
}
