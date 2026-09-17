import assert from "node:assert/strict";
import test from "node:test";

import { applyPreviewFragmentQuery } from "../packages/viewer/dist/client/preview_fragment.js";

test("preview fragment queries update every applicable frame source", () => {
  const first = frame({
    "data-fragment-dark": "/static/screen.dark",
    "data-fragment-light": "/static/screen",
    "data-mokly-fragment-frame": "",
    src: "/static/screen",
  });
  const second = frame({
    "data-mokly-fragment-frame": "",
    src: "/static/light-only",
  });
  const laterFlowStep = frame({
    "data-fragment-dark": "/static/later.dark",
    "data-fragment-light": "/static/later",
    src: "/static/later",
  });
  const doc = documentWith([first, second, laterFlowStep]);

  assert.equal(
    applyPreviewFragmentQuery(asDocument(doc), "?fragment=section%3Aone"),
    true,
  );
  assert.deepEqual(attributes(first), {
    dark: "/static/screen.dark#section%3Aone",
    light: "/static/screen#section%3Aone",
    src: "/static/screen#section%3Aone",
  });
  assert.equal(second.getAttribute("src"), "/static/light-only#section%3Aone");
  assert.equal(laterFlowStep.getAttribute("src"), "/static/later");
});

test("preview fragment queries fail closed without interpreting selectors", () => {
  for (const search of [
    "",
    "?fragment=one&fragment=two",
    "?fragment=%23section",
    "?fragment=%2523section",
    "?fragment=1section",
    "?fragment=section+one",
  ]) {
    const target = frame({
      "data-fragment-dark": "/static/screen.dark#old",
      "data-fragment-light": "/static/screen#old",
      "data-mokly-fragment-frame": "",
      src: "/static/screen#old",
    });
    const doc = documentWith([target]);

    assert.equal(
      applyPreviewFragmentQuery(asDocument(doc), search),
      false,
      search,
    );
    assert.deepEqual(attributes(target), {
      dark: "/static/screen.dark#old",
      light: "/static/screen#old",
      src: "/static/screen#old",
    });
    assert.equal(doc.selectorQueries, 0);
  }
});

test("a valid absent anchor retains its encoded hash without DOM lookup", () => {
  const target = frame({
    "data-mokly-fragment-frame": "",
    src: "/static/screen?mode=preview#old",
  });
  const doc = documentWith([target]);

  assert.equal(
    applyPreviewFragmentQuery(asDocument(doc), "?fragment=absent"),
    true,
  );
  assert.equal(
    target.getAttribute("src"),
    "/static/screen?mode=preview#absent",
  );
  assert.equal(doc.selectorQueries, 0);
});

function attributes(element: FakeFrame): Record<string, string | null> {
  return {
    dark: element.getAttribute("data-fragment-dark"),
    light: element.getAttribute("data-fragment-light"),
    src: element.getAttribute("src"),
  };
}

function frame(values: Readonly<Record<string, string>>): FakeFrame {
  return new FakeFrame(values);
}

function documentWith(frames: readonly FakeFrame[]): FakeDocument {
  return new FakeDocument(frames);
}

function asDocument(value: FakeDocument): Document {
  return value as unknown as Document;
}

class FakeFrame {
  readonly #attributes: Map<string, string>;

  constructor(values: Readonly<Record<string, string>>) {
    this.#attributes = new Map(Object.entries(values));
  }

  getAttribute(name: string): string | null {
    return this.#attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.#attributes.set(name, value);
  }
}

class FakeDocument {
  selectorQueries = 0;

  constructor(private readonly frames: readonly FakeFrame[]) {}

  querySelectorAll(selector: string): readonly FakeFrame[] {
    if (selector !== "iframe[data-mokly-fragment-frame]") {
      this.selectorQueries += 1;
    }
    return this.frames.filter(
      (frame) => frame.getAttribute("data-mokly-fragment-frame") !== null,
    );
  }
}
