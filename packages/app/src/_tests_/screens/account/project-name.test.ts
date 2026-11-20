import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import {
  projectName,
  projectNameLimit,
} from "../../../screens/account/project-name";
import { repositoryRoot } from "../../root";

function object(value: unknown): Record<string, unknown> {
  assert.ok(
    typeof value === "object" && value !== null && !Array.isArray(value),
  );
  return Object.fromEntries(Object.entries(value));
}

/**
 * The longest display name each project create shape accepts, as
 * `docs/api/openapi.json` states it on the shape's `name`.
 */
function documentedNameLimits(): number[] {
  const document: unknown = JSON.parse(
    readFileSync(resolve(repositoryRoot, "docs/api/openapi.json"), "utf8"),
  );
  const schemas = object(object(object(document).components).schemas);
  const shapes = object(schemas.CreateProject).oneOf;
  assert.ok(Array.isArray(shapes), "CreateProject must list its shapes");
  return shapes.map((shape: unknown) => {
    const name = String(object(shape).$ref).split("/").pop() ?? "";
    const limit = object(
      object(object(schemas[name]).properties).name,
    ).maxLength;
    assert.ok(typeof limit === "number", name + ".name must state maxLength");
    return limit;
  });
}

/** The one display name limit both project create shapes document. */
function documentedNameLimit(): number {
  const limits = documentedNameLimits();
  assert.ok(limits.length > 0, "CreateProject lists no shape");
  assert.equal(new Set(limits).size, 1, "the shapes disagree on the limit");
  return limits[0];
}

test("the display name limit is the one the API documents", () => {
  assert.equal(projectNameLimit, documentedNameLimit());
});

test("a project is named for its repository's own name", () => {
  assert.equal(projectName("mokly-ai/mokly-cloud"), "mokly-cloud");
  assert.equal(projectName("gitlab.com/mokly-ai/web/site"), "site");
  assert.equal(projectName("git.example.com/team/site.git"), "site");
  assert.equal(projectName(" mokly-ai/mokly "), "mokly");
  assert.equal(projectName("solo"), "solo");
  // A name that is only the clone suffix keeps it rather than becoming empty.
  assert.equal(projectName("owner/.git"), ".git");
});

test("a repository name longer than a display name is cut to the limit", () => {
  const limit = documentedNameLimit();
  const exact = "a".repeat(limit);
  assert.equal(projectName("owner/" + exact), exact);
  assert.equal(projectName("owner/" + exact + "a"), exact);
  // Another host allows names far longer than GitHub's; the clone suffix goes
  // before the cut.
  assert.equal(
    projectName("gitlab.com/team/" + "b".repeat(255)),
    "b".repeat(limit),
  );
  assert.equal(projectName("git.example.com/team/" + exact + ".git"), exact);
});

test("a cut name ends on a character, not on a separator", () => {
  const limit = documentedNameLimit();
  const before = "c".repeat(limit - 2);
  // The cut would end on the separators; the name keeps what precedes them.
  assert.equal(projectName("owner/" + before + "-_.tail"), before);
  // A name that is only separators keeps them rather than becoming empty.
  assert.equal(
    projectName("owner/" + ".".repeat(limit + 5)),
    ".".repeat(limit),
  );
  // A name of exactly the limit keeps its own last separator.
  assert.equal(
    projectName("owner/" + "d".repeat(limit - 1) + "-"),
    "d".repeat(limit - 1) + "-",
  );
  // The limit counts characters, so a character outside the basic plane, two
  // UTF-16 units, is never split.
  const wide = projectName("owner/" + "😀".repeat(limit + 1));
  assert.equal(Array.from(wide).length, limit);
  assert.equal(wide, "😀".repeat(limit));
});
