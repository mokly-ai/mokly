import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";

test("tracked source and filenames use only the current product identity", () => {
  const retiredIdentity = ["moka", "book"].join("");
  const candidates = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: repositoryRoot, encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean);
  const matches: string[] = [];

  for (const candidate of candidates) {
    const absolute = path.join(repositoryRoot, candidate);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
    if (candidate.toLowerCase().includes(retiredIdentity)) {
      matches.push(candidate);
      continue;
    }
    const content = fs.readFileSync(absolute);
    if (
      !content.includes(0) &&
      content.toString("utf8").toLowerCase().includes(retiredIdentity)
    )
      matches.push(candidate);
  }

  assert.deepEqual(matches, []);
});
