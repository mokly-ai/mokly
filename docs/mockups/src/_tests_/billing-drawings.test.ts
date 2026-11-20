import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { screenFile } from "./catalogue-paths";

function drawing(id: string): string {
  return readFileSync(screenFile(id, "desktop"), "utf8");
}

test("the downgraded Workspace pane gives each role its way on", () => {
  const owner = drawing("product/settings/workspace/plan");
  assert.match(owner, /Publishing to private projects is on Team\./);
  assert.match(owner, /Open billing/);
  assert.doesNotMatch(owner, /Ask an owner to upgrade to Team\./);

  const member = drawing("product/settings/workspace/plan-member");
  assert.match(member, /Publishing to private projects is on Team\./);
  assert.match(member, /Ask an owner to upgrade to Team\./);
  assert.doesNotMatch(member, /Open billing/);
});

test("delayed confirmation offers one fresh read and no plan action", () => {
  const delayed = drawing("product/settings/billing/delayed");
  assert.match(delayed, /Still confirming your subscription/);
  assert.match(delayed, /Check again/);
  assert.doesNotMatch(delayed, /Upgrade to Team|fo-facts/);
});

test("read-only access and created-project facts do not repeat consequences", () => {
  for (const id of ["product/settings/access", "product/settings/access/empty"])
    assert.doesNotMatch(drawing(id), /Each grant adds a seat/);

  for (const id of [
    "product/account/project-created",
    "product/account/project-created/empty",
  ]) {
    const created = drawing(id);
    assert.match(created, /Visibility/);
    assert.match(created, /Public/);
    assert.doesNotMatch(created, /Projects are public on the free plan\./);
  }
});
