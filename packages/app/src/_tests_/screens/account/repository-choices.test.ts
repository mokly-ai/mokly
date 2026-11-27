import assert from "node:assert/strict";
import { test } from "node:test";

import type { Installation, Repository } from "../../../api/types";
import {
  chosenRepository,
  repositoryOptions,
} from "../../../screens/account/repository-choices";

function installation(
  account: string,
  state: Installation["state"] = "connected",
): Installation {
  return {
    id: account + "-installation",
    workspaceId: "workspace",
    accountKind: account === "cal" ? "user" : "organization",
    state,
    account,
    manageUrl: "https://github.com/settings/installations/" + account,
  } satisfies Installation;
}

function repository(fullName: string, secret = false): Repository {
  return {
    id: fullName + "-id",
    installationId: fullName.split("/")[0] + "-installation",
    fullName,
    defaultBranch: "main",
    private: secret,
  } satisfies Repository;
}

const organization = {
  installation: installation("mokly-ai"),
  repositories: [
    repository("mokly-ai/mokly-cloud", true),
    repository("mokly-ai/mokly"),
  ],
};
const personal = {
  installation: installation("cal"),
  repositories: [repository("cal/release-notes", true)],
};

test("one connected account keeps the select flat", () => {
  assert.deepEqual(repositoryOptions([organization]), {
    options: [
      {
        value: "mokly-ai/mokly-cloud-id",
        label: "mokly-ai/mokly-cloud",
        secondary: "Private",
      },
      {
        value: "mokly-ai/mokly-id",
        label: "mokly-ai/mokly",
        secondary: "Public",
      },
    ],
  });
  assert.deepEqual(repositoryOptions([]), { options: [] });
});

test("several connected accounts take one titled section each", () => {
  const grouped = repositoryOptions([organization, personal]);
  assert.deepEqual(grouped.options, []);
  assert.deepEqual(
    grouped.sections?.map((section) => ({
      title: section.title,
      options: section.options.map((option) => option.label),
    })),
    [
      {
        title: "mokly-ai",
        options: ["mokly-ai/mokly-cloud", "mokly-ai/mokly"],
      },
      { title: "cal", options: ["cal/release-notes"] },
    ],
  );
  // An account that grants nothing has no title over nothing.
  const empty = { installation: installation("empty-org"), repositories: [] };
  assert.deepEqual(
    repositoryOptions([organization, empty]).sections?.map(
      (section) => section.title,
    ),
    ["mokly-ai"],
  );
});

test("the chosen repository is found in whichever account holds it", () => {
  const accounts = [organization, personal];
  assert.equal(
    chosenRepository(accounts, "cal/release-notes-id")?.fullName,
    "cal/release-notes",
  );
  assert.equal(chosenRepository(accounts, ""), undefined);
  assert.equal(chosenRepository(accounts, "gone"), undefined);
});
