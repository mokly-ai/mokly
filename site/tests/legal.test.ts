import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  POLICIES,
  crossPolicy,
  effectiveDate,
  legalSchema,
  type PolicyId,
} from "../src/legal.js";
import { SITE_PATHS } from "../src/navigation.js";
import { sitePath } from "../src/workspace.js";

const BODIES: Readonly<Record<PolicyId, string>> = {
  privacy: "Privacy details are being prepared",
  terms: "Terms are being prepared",
};

function document(id: PolicyId): string {
  return readFileSync(sitePath("src", "content", "legal", `${id}.md`), "utf8");
}

test("both policies publish the exact placeholder body", () => {
  for (const id of Object.keys(POLICIES) as PolicyId[]) {
    const source = document(id);
    const [, frontmatter = "", body = ""] = source.split("---\n");
    assert.equal(body.trim(), `## ${BODIES[id]}`);
    assert.doesNotMatch(frontmatter, /effective/, "no date is invented");
  }
});

test("the frontmatter names a title and an optional effective date", () => {
  assert.deepEqual(legalSchema.parse({ title: "Terms" }), { title: "Terms" });
  assert.deepEqual(
    legalSchema.parse({ effective: "2026-10-01", title: "Terms" }),
    {
      effective: new Date("2026-10-01T00:00:00.000Z"),
      title: "Terms",
    },
  );
  assert.throws(() => legalSchema.parse({ title: "" }));
  assert.throws(() => legalSchema.parse({ effective: "soon", title: "Terms" }));
});

test("every checked-in policy document parses against the schema", () => {
  for (const id of Object.keys(POLICIES) as PolicyId[]) {
    const title = /title:\s*(.+)/.exec(document(id))?.[1]?.trim() ?? "";
    assert.deepEqual(legalSchema.parse({ title }), { title });
  }
});

test("a date is shown only when the document declares one", () => {
  assert.equal(effectiveDate(undefined), undefined);
  assert.deepEqual(effectiveDate(new Date("2026-10-01T00:00:00.000Z")), {
    datetime: "2026-10-01",
    readable: "1 October 2026",
  });
});

test("each policy links across to the other one", () => {
  assert.deepEqual(crossPolicy("terms"), {
    label: "Privacy",
    route: SITE_PATHS.privacy,
  });
  assert.deepEqual(crossPolicy("privacy"), {
    label: "Terms",
    route: SITE_PATHS.terms,
  });
});
