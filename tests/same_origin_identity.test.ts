import assert from "node:assert/strict";
import test from "node:test";

import {
  assignedFrameResource,
  authenticateAssignedDocument,
  normalizedHtmlPath,
  sameFrameResource,
  transferAuthenticatedDocument,
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

test("only a recorded immediate document transfers to its owning frame", () => {
  const owning = fakeFrame();
  const other = fakeFrame();
  const expected = new URL("https://app.test/static/screen.html?revision=2");
  const mismatched = fakeDocument(other.frame, expected.href);
  const unrecorded = fakeDocument(owning.frame, expected.href);
  const recorded = fakeDocument(owning.frame, expected.href);

  assert.equal(
    authenticateAssignedDocument(owning.frame, mismatched, expected),
    undefined,
  );
  assert.equal(
    transferAuthenticatedDocument(owning.frame, unrecorded),
    undefined,
  );
  assert.equal(
    authenticateAssignedDocument(
      owning.frame,
      recorded,
      new URL("https://app.test/static/other.html?revision=2"),
    ),
    undefined,
  );
  assert.equal(
    authenticateAssignedDocument(owning.frame, recorded, expected),
    recorded,
  );
  assert.equal(transferAuthenticatedDocument(owning.frame, recorded), recorded);
  assert.equal(transferAuthenticatedDocument(other.frame, recorded), undefined);
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
