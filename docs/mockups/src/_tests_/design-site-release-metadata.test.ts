import assert from "node:assert/strict";
import { test } from "node:test";

import changelog from "../entries/design/site/changelog.mockup";
import { RELEASES } from "../screens/design/site/parts/releases";

test("changelog metadata names the depicted first and last releases", () => {
  const first = RELEASES[0];
  const last = RELEASES.at(-1);
  assert.ok(first && last);
  assert.equal(
    changelog.description,
    `The installed Mokly ${first.version} through ${last.version} release facts rendered as the site changelog.`,
  );
});
