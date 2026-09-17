import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";
import { GUIDES } from "./helpers/guides.js";

const version = (
  JSON.parse(
    readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
  ) as {
    version: string;
  }
).version;

const START = "<!-- x-release-please-start-version -->";
const END = "<!-- x-release-please-end -->";

test("every semantic version literal equals the package version", () => {
  const found: Array<{ id: string; literal: string }> = [];
  for (const guide of GUIDES) {
    for (const match of guide.body.matchAll(
      /(?<![\d.])\d+\.\d+\.\d+(?!\.\d)/gu,
    ))
      found.push({ id: guide.id, literal: match[0] });
  }
  assert.deepEqual(found, [
    { id: "start/install", literal: version },
    { id: "start/install", literal: version },
    { id: "ci/github-action", literal: version },
  ]);
});

test("the two release-managed files bound every version-bearing line", () => {
  const expected = new Map([
    ["start/install", 2],
    ["ci/github-action", 1],
  ]);
  for (const guide of GUIDES) {
    const starts = guide.body.split(START).length - 1;
    const ends = guide.body.split(END).length - 1;
    assert.equal(starts, expected.get(guide.id) ?? 0, guide.id);
    assert.equal(ends, starts, guide.id);
    for (const region of guide.body.split(START).slice(1)) {
      const body = region.split(END)[0] ?? "";
      assert.match(
        body,
        new RegExp(`\\b${version.replaceAll(".", "\\.")}\\b`, "u"),
        guide.id,
      );
    }
  }
  const install = GUIDES.find((guide) => guide.id === "start/install")?.body;
  assert.match(
    install ?? "",
    new RegExp(
      `npm install --save-dev @mokly/mokly@${version.replaceAll(".", "\\.")}`,
      "u",
    ),
  );
  assert.match(
    install ?? "",
    new RegExp(`describes version ${version.replaceAll(".", "\\.")}`, "u"),
  );
});
