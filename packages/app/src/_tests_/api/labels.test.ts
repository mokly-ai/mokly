import assert from "node:assert/strict";
import { test } from "node:test";

import { accountKindLabels, githubAccountsLabel } from "../../api/labels";
import type { Installation } from "../../api/types";

function installation(
  account: string,
  state: Installation["state"],
): Installation {
  return {
    id: account,
    workspaceId: "workspace",
    accountKind: "organization",
    state,
    account,
    manageUrl: "https://github.com/settings/installations/1",
  } satisfies Installation;
}

test("the GitHub accounts fact names every account, a suspension included", () => {
  assert.equal(githubAccountsLabel([]), "None");
  assert.equal(
    githubAccountsLabel([installation("mokly-ai", "connected")]),
    "mokly-ai",
  );
  assert.equal(
    githubAccountsLabel([
      installation("mokly-ai", "connected"),
      installation("cal", "connected"),
    ]),
    "mokly-ai, cal",
  );
  assert.equal(
    githubAccountsLabel([
      installation("mokly-ai", "suspended"),
      installation("cal", "connected"),
    ]),
    "mokly-ai · Suspended, cal",
  );
});

test("an account's kind reads as GitHub's personal account or organization", () => {
  assert.deepEqual(accountKindLabels, {
    user: "Personal",
    organization: "Organization",
  });
});
