import assert from "node:assert/strict";
import test from "node:test";

import { localFrameAccess } from "../src/adapters/same_origin_access.js";
import { createMountAuthentication } from "../src/adapters/same_origin_identity.js";

test("local inspection stays unavailable when the immediate document cannot authenticate", () => {
  const frame = { contentDocument: null } as unknown as HTMLIFrameElement;
  const url = new URL("https://app.test/static/screen.html");
  const authentication = createMountAuthentication(frame, null, url);
  assert.equal(
    authentication.authenticateAssignedDocument(frame.contentDocument, url),
    undefined,
  );
});

test("replacing a local frame preserves the exact query and fragment", () => {
  const replacements: string[] = [];
  const frame = {
    contentWindow: {
      location: { replace: (url: string) => replacements.push(url) },
    },
  } as unknown as HTMLIFrameElement;
  const url = new URL("https://app.test/static/screen.html?revision=2#summary");
  localFrameAccess(frame).replace(url);
  assert.deepEqual(replacements, [url.href]);
});
