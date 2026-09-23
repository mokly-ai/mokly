import assert from "node:assert/strict";
import test from "node:test";

import {
  assignedFrameResource,
  createMountAuthentication,
  normalizedHtmlPath,
  sameFrameResource,
} from "../packages/viewer/dist/client/same_origin_identity.js";

test("resource identity retains origin, path and query while excluding hash", () => {
  const expected = new URL(
    "https://app.test/static/screen?revision=2#expected",
  );

  assert.equal(
    sameFrameResource(
      "https://app.test/static/screen.html?revision=2#actual",
      expected,
    ),
    true,
  );
  assert.equal(
    sameFrameResource(
      "https://other.test/static/screen.html?revision=2",
      expected,
    ),
    false,
  );
  assert.equal(
    sameFrameResource(
      "https://user:secret@app.test/static/screen.html?revision=2",
      expected,
    ),
    false,
  );
  assert.equal(
    sameFrameResource(
      "https://app.test/static/screen.html?revision=3",
      expected,
    ),
    false,
  );
  assert.equal(normalizedHtmlPath("/static/screen.html"), "/static/screen");
  assert.equal(normalizedHtmlPath("/static/screen.htm"), "/static/screen.htm");
});

test("assigned frame resources resolve against the owner document", () => {
  const fixture = fakeFrame("https://app.test/catalogue/index.html");
  const expected = new URL(
    "https://app.test/static/screen?revision=2#expected",
  );

  fixture.attributes.set("src", "../../static/screen.html?revision=2#assigned");
  assert.equal(assignedFrameResource(fixture.frame, expected), true);
  fixture.attributes.set("src", "https://other.test/static/screen.html");
  assert.equal(assignedFrameResource(fixture.frame, expected), false);
  fixture.attributes.set("src", "http://[");
  assert.equal(assignedFrameResource(fixture.frame, expected), false);
});

test("the first mount authenticates a matching immediate document", () => {
  const owning = fakeFrame();
  const other = fakeFrame();
  const expected = new URL("https://app.test/static/screen.html?revision=2");
  const mismatched = fakeDocument(other.frame, expected.href);
  const recorded = fakeDocument(owning.frame, expected.href);
  const authentication = createMountAuthentication(
    owning.frame,
    recorded,
    expected,
  );

  assert.equal(
    authentication.authenticateAssignedDocument(mismatched, expected),
    undefined,
  );
  assert.equal(
    authentication.authenticateAssignedDocument(
      recorded,
      new URL("https://app.test/static/other.html?revision=2"),
    ),
    undefined,
  );
  assert.equal(
    authentication.authenticateAssignedDocument(recorded, expected),
    recorded,
  );
});

test("only a recorded immediate document transfers to a later mount", () => {
  const owning = fakeFrame();
  const other = fakeFrame();
  const expected = new URL("https://app.test/static/screen.html?revision=2");
  const recorded = fakeDocument(owning.frame, expected.href);
  const first = createMountAuthentication(owning.frame, recorded, expected);

  assert.equal(
    first.authenticateAssignedDocument(recorded, expected),
    recorded,
  );
  assert.equal(
    createMountAuthentication(owning.frame, recorded, expected)
      .transferredDocument,
    recorded,
  );
  assert.equal(
    createMountAuthentication(other.frame, recorded, expected)
      .transferredDocument,
    undefined,
  );
});

test("a later mount excludes its exact unrecorded starting document", () => {
  const fixture = fakeFrame();
  const firstUrl = new URL("https://app.test/static/first.html");
  const nextUrl = new URL("https://app.test/static/next.html?revision=2");
  const hydrated = fakeDocument(fixture.frame, firstUrl.href);
  const first = createMountAuthentication(fixture.frame, hydrated, firstUrl);
  assert.equal(
    first.authenticateAssignedDocument(hydrated, firstUrl),
    hydrated,
  );

  const unowned = fakeDocument(fixture.frame, nextUrl.href);
  const replacement = createMountAuthentication(
    fixture.frame,
    unowned,
    nextUrl,
  );
  assert.equal(replacement.transferredDocument, undefined);
  assert.equal(
    replacement.authenticateAssignedDocument(unowned, nextUrl),
    undefined,
  );

  const loaded = fakeDocument(fixture.frame, nextUrl.href);
  assert.equal(
    replacement.authenticateAssignedDocument(loaded, nextUrl),
    loaded,
  );
});

function fakeFrame(baseURI = "https://app.test/") {
  const attributes = new Map<string, string>();
  const frame = {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    ownerDocument: { baseURI },
  } as unknown as HTMLIFrameElement;
  return { attributes, frame };
}

function fakeDocument(frame: HTMLIFrameElement, url: string): Document {
  return {
    URL: url,
    defaultView: { frameElement: frame },
  } as unknown as Document;
}
