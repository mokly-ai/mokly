import assert from "node:assert/strict";
import test from "node:test";

import { situationIdentityViolations } from "./product-situation-policy";
import { productSituations } from "./product-situations";

const owner = {
  path: "product/settings/workspace/slug",
  family: "settings",
  screen: "workspace",
  name: "slug",
} as const;
const child = {
  ...owner,
  path: "product/settings/workspace/slug/conflict",
  name: "conflict",
  parent: owner.path,
};

test("situation identities match canonical screens and declared parents", () => {
  assert.deepEqual(situationIdentityViolations(productSituations), []);
  assert.deepEqual(situationIdentityViolations([owner, child]), []);
});

for (const [name, fixtures, prefix] of [
  [
    "another family",
    [{ ...owner, path: "product/account/workspace/slug" }],
    "situation stays under its owning screen",
  ],
  [
    "another screen",
    [{ ...owner, path: "product/settings/project/slug" }],
    "situation stays under its owning screen",
  ],
  [
    "unknown screen",
    [{ ...owner, screen: "unknown", path: "product/settings/unknown/slug" }],
    "situation names a known screen",
  ],
  [
    "leaf differs from its name",
    [{ ...owner, path: "product/settings/workspace/other" }],
    "situation path matches its screen or parent",
  ],
  [
    "missing parent",
    [{ ...child, parent: "product/settings/workspace/missing" }],
    "situation needs a parent with the same owner",
  ],
  [
    "parent from another screen",
    [
      owner,
      {
        ...child,
        screen: "project",
        path: "product/settings/project/slug/conflict",
      },
    ],
    "situation needs a parent with the same owner",
  ],
  [
    "child outside its parent",
    [owner, { ...child, path: "product/settings/workspace/conflict" }],
    "situation path matches its screen or parent",
  ],
  ["duplicate path", [owner, owner], "duplicate situation path"],
] as const)
  test("situation identities reject " + name, () => {
    assert.ok(
      situationIdentityViolations(fixtures).some((problem) =>
        problem.startsWith(prefix),
      ),
      name,
    );
  });

test("the documented recovery sibling preserves logical slug ownership", () => {
  const recovery = productSituations.find(
    (situation) =>
      situation.path === "product/settings/workspace/slug-recovery",
  );
  assert.ok(recovery);
  assert.deepEqual(situationIdentityViolations([owner, recovery]), []);
  assert.ok(
    situationIdentityViolations([owner, { ...recovery, name: "other" }]).some(
      (problem) => problem.startsWith("situation path matches"),
    ),
  );
});
