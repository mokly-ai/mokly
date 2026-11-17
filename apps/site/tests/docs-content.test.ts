import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { readFrontmatter } from "../src/docs/frontmatter.js";
import { DOCS_PAGES } from "../src/docs/pages.js";
import { repositoryPath } from "../src/workspace.js";

/** Every page written from the cloud protocol docs, in reading order. */
const AHEAD_PAGES = [
  "cloud/overview",
  "cloud/connect-a-repository",
  "cloud/builds",
  "cloud/branches-and-pull-requests",
  "cloud/sharing-and-access",
  "cloud/workspaces-and-roles",
  "cloud/settings",
  "cloud/plans-and-billing",
  "review/comments",
  "review/approvals",
  "review/pull-request-sync",
  "review/agent-sessions",
  "review/click-to-reference",
];

/** The cloud repository documents an ahead page may cite as its source. */
const CLOUD_DOCUMENTS = [
  "product-direction.md",
  "protocol/cloud/approvals.md",
  "protocol/cloud/billing-plan-gates.md",
  "protocol/cloud/billing-subscriptions.md",
  "protocol/cloud/billing.md",
  "protocol/cloud/cloud-build-runner.md",
  "protocol/cloud/cloud-builds.md",
  "protocol/cloud/product-accounts-and-roles.md",
  "protocol/cloud/product-navigation.md",
  "protocol/cloud/screen-comments.md",
  "protocol/cloud/settings-dialog.md",
  "protocol/cloud/settings-dialog-github.md",
  "protocol/cloud/viewer-builds.md",
  "protocol/cloud/viewer.md",
];

test("frontmatter is read and validated against the content model", () => {
  const { data, body } = readFrontmatter(
    '---\ntitle: "Install"\ndescription: "Add Mokly."\nsection: "start"\norder: 1\n---\n\nBody.\n',
    "start/install.md",
  );
  assert.deepEqual(data, {
    description: "Add Mokly.",
    order: 1,
    section: "start",
    title: "Install",
  });
  assert.equal(body.trim(), "Body.");
});

test("frontmatter rejects an unknown section and a missing field", () => {
  assert.throws(
    () =>
      readFrontmatter(
        '---\ntitle: "T"\ndescription: "D"\nsection: "guides"\norder: 1\n---\n',
        "guides/t.md",
      ),
    /section/,
  );
  assert.throws(
    () =>
      readFrontmatter(
        '---\ntitle: "T"\nsection: "cli"\norder: 1\n---\n',
        "cli/t.md",
      ),
    /description/,
  );
  assert.throws(
    () => readFrontmatter("Body only\n", "cli/t.md"),
    /frontmatter/,
  );
});

test("an ahead page keeps its status and it is never rendered", () => {
  const { data } = readFrontmatter(
    '---\ntitle: "Overview"\ndescription: "D"\nsection: "cloud"\norder: 1\nstatus: "ahead"\n---\n',
    "cloud/overview.md",
  );
  assert.equal(data.status, "ahead");
  assert.deepEqual(
    DOCS_PAGES.filter((entry) => entry.status === "ahead").map(
      (entry) => entry.id,
    ),
    AHEAD_PAGES,
    "the ahead pages are the cloud and review sections",
  );
});

test("every ahead page cites the cloud document it was written from", () => {
  for (const entry of DOCS_PAGES.filter((page) => page.status === "ahead")) {
    const { body } = readFrontmatter(
      readFileSync(entry.source, "utf8"),
      entry.id,
    );
    const cited =
      /^<!-- Source: mokly-cloud ([\w./-]+\.md(?:, [\w./-]+\.md)*) -->$/m.exec(
        body,
      );
    assert.ok(cited, `${entry.id} names no cloud protocol document`);
    for (const citation of (cited[1] ?? "").split(", ")) {
      const document = citation.replace(
        /^protocol\/(?!cloud\/)/u,
        "protocol/cloud/",
      );
      assert.ok(
        CLOUD_DOCUMENTS.includes(document),
        `${entry.id} cites ${document}, which is not a cloud protocol document`,
      );
      assert.ok(
        readFileSync(repositoryPath("docs", document), "utf8").length > 0,
        `${entry.id} cites missing docs/${document}`,
      );
    }
  }
});

test("only the cloud and review sections are written ahead of release", () => {
  const ahead = new Set(AHEAD_PAGES.map((id) => id.split("/")[0]));
  assert.deepEqual([...ahead].sort(), ["cloud", "review"]);
  for (const entry of DOCS_PAGES) {
    assert.equal(
      entry.status === "ahead",
      ahead.has(entry.section),
      `${entry.id} disagrees with its section's release status`,
    );
  }
});
