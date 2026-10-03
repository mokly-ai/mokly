import assert from "node:assert/strict";
import test from "node:test";

import { createMountAuthentication } from "../packages/viewer/dist/client/same_origin_identity.js";
import { initialFrameLoad } from "../packages/viewer/dist/client/same_origin_load.js";

const light = new URL("https://app.test/static/screen.mobile.html");
const dark = new URL("https://app.test/static/screen.mobile.dark.html");

for (const readyState of ["loading", "interactive", "complete"] as const) {
  test(`first hydration reuses its matching ${readyState} document`, () => {
    const frame = fakeFrame(light);
    const current = fakeDocument(frame, light, readyState);
    const authentication = createMountAuthentication(frame, current, light);

    assert.equal(
      initialFrameLoad(frame, current, light, authentication),
      readyState === "complete" ? "adopt" : "wait",
    );
  });

  test(`an authenticated ${readyState} document reconnects with a stale src`, () => {
    const frame = fakeFrame(light);
    const current = fakeDocument(frame, dark, readyState);
    const first = createMountAuthentication(frame, current, dark);
    assert.equal(first.authenticateAssignedDocument(current, dark), current);
    const authentication = createMountAuthentication(frame, current, dark);

    assert.equal(
      initialFrameLoad(frame, current, dark, authentication),
      readyState === "complete" ? "adopt" : "wait",
    );
  });

  for (const url of [light, dark]) {
    test(`an unowned ${readyState} ${url === light ? "matching" : "recorded"} document is replaced`, () => {
      const frame = fakeFrame(light);
      const initial = fakeDocument(frame, light, "complete");
      const first = createMountAuthentication(frame, initial, light);
      first.authenticateAssignedDocument(initial, light);
      const current = fakeDocument(frame, url, readyState);
      const authentication = createMountAuthentication(frame, current, light);

      assert.equal(
        initialFrameLoad(frame, current, light, authentication),
        "replace",
      );
    });
  }

  test(`a changed assignment replaces an authenticated ${readyState} document`, () => {
    const frame = fakeFrame(light);
    const current = fakeDocument(frame, dark, readyState);
    const first = createMountAuthentication(frame, current, dark);
    first.authenticateAssignedDocument(current, dark);
    const authentication = createMountAuthentication(frame, current, light);

    assert.equal(
      initialFrameLoad(frame, current, light, authentication),
      "replace",
    );
  });

  test(`a superseded request is replaced even while the ${readyState} document matches`, () => {
    const frame = fakeFrame(light);
    const current = fakeDocument(frame, light, readyState);
    const first = createMountAuthentication(frame, current, light);
    first.authenticateAssignedDocument(current, light);
    createMountAuthentication(frame, current, dark);
    const authentication = createMountAuthentication(frame, current, light);

    assert.equal(
      initialFrameLoad(frame, current, light, authentication),
      "replace",
    );
  });

  test(`first hydration waits for a startup swap from a ${readyState} recorded document`, () => {
    const frame = fakeFrame(dark);
    const current = fakeDocument(frame, light, readyState);
    const authentication = createMountAuthentication(frame, current, dark);

    assert.equal(
      initialFrameLoad(frame, current, dark, authentication),
      "wait",
    );
  });
}

test("first hydration waits for an assigned frame before its document arrives", () => {
  for (const blank of [null, new URL("about:blank")]) {
    const frame = fakeFrame(light);
    const current = blank ? fakeDocument(frame, blank, "complete") : null;
    const authentication = createMountAuthentication(frame, current, light);

    assert.equal(
      initialFrameLoad(frame, current, light, authentication),
      "wait",
    );
  }
});

test("first hydration starts a requested navigation when src names another resource", () => {
  const frame = fakeFrame(dark);
  const current = fakeDocument(frame, light, "complete");
  const authentication = createMountAuthentication(frame, current, light);

  assert.equal(
    initialFrameLoad(frame, current, light, authentication),
    "replace",
  );
});

function fakeFrame(source: URL): HTMLIFrameElement {
  return {
    dataset: { fragmentDark: dark.href, fragmentLight: light.href },
    getAttribute: (name: string) => (name === "src" ? source.href : null),
    ownerDocument: { baseURI: "https://app.test/" },
  } as unknown as HTMLIFrameElement;
}

function fakeDocument(
  frame: HTMLIFrameElement,
  url: URL,
  readyState: DocumentReadyState,
): Document {
  return {
    URL: url.href,
    defaultView: { frameElement: frame },
    readyState,
  } as unknown as Document;
}
