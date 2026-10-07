import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import { PublicFilePolicy } from "../dist/config/public_policy.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("one compilation classifies each authored path once and a new policy rechecks it", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const candidate = path.join(fixture.mockupsDir, "theme.css");
  await fs.promises.writeFile(candidate, "body {}");
  const config = await loadConfig(fixture.root);
  const policy = new PublicFilePolicy(config);
  const original = fs.lstatSync;
  let checks = 0;
  const probe = t.mock.method(
    fs,
    "lstatSync",
    (...args: Parameters<typeof fs.lstatSync>) => {
      if (args[0] === candidate) checks++;
      return Reflect.apply(original, fs, args);
    },
  );
  assert.equal(policy.inspect("theme.css").kind, "public");
  const firstChecks = checks;
  assert.ok(firstChecks > 0);
  for (let i = 0; i < 100; i++)
    assert.equal(policy.inspect("theme.css").kind, "public");
  assert.equal(checks, firstChecks);
  probe.mock.restore();
  await fs.promises.rm(candidate);
  assert.equal(
    new PublicFilePolicy(config).inspect("theme.css").kind,
    "missing",
  );
  assert.equal(policy.read("theme.css"), undefined);
});
