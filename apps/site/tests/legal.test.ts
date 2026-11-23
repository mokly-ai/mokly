import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import { parse } from "yaml";

import {
  POLICIES,
  effectiveDate,
  legalSchema,
  relatedPolicies,
  type PolicyId,
} from "../src/legal.js";
import { SITE_PATHS } from "../src/navigation.js";
import { sitePath } from "../src/workspace.js";

const DOCUMENTS: Readonly<
  Record<PolicyId, { readonly firstHeading: string; readonly sections: number }>
> = {
  complaints: { firstHeading: "1. How to complain", sections: 5 },
  privacy: { firstHeading: "1. Controller and service role", sections: 13 },
  security: { firstHeading: "1. Hosting and isolation", sections: 10 },
  terms: { firstHeading: "1. What Mokly does", sections: 16 },
};

const OPERATOR = "Calum Moore Consulting Limited";
const COMPANY_NUMBER = "09018453";

function source(id: PolicyId): string {
  return readFileSync(sitePath("src", "content", "legal", `${id}.md`), "utf8");
}

function document(id: PolicyId): {
  readonly body: string;
  readonly frontmatter: unknown;
} {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source(id));
  assert.ok(match, `${id} has Markdown frontmatter`);
  return { body: match[2] ?? "", frontmatter: parse(match[1] ?? "") };
}

test("all four legal documents are substantive Markdown", () => {
  assert.deepEqual(Object.keys(POLICIES), [
    "terms",
    "privacy",
    "complaints",
    "security",
  ]);
  assert.deepEqual(
    readdirSync(sitePath("src", "content", "legal"))
      .filter((name) => name.endsWith(".md"))
      .sort(),
    Object.keys(POLICIES)
      .map((id) => `${id}.md`)
      .sort(),
  );
  for (const id of Object.keys(POLICIES) as PolicyId[]) {
    const { body } = document(id);
    const expected = DOCUMENTS[id];
    assert.match(body, new RegExp(`^.+\\n\\n## ${expected.firstHeading}`, "s"));
    assert.equal(body.match(/^## /gm)?.length, expected.sections, id);
    assert.match(body, /hello@mokly\.ai/);
    assert.doesNotMatch(body, /being prepared/i);
    assert.doesNotMatch(body, /<[A-Z][^>]*>/, `${id} stays Markdown, not MDX`);
  }
});

test("every checked-in legal document parses with an effective date", () => {
  for (const id of Object.keys(POLICIES) as PolicyId[]) {
    const parsed = legalSchema.parse(document(id).frontmatter);
    assert.equal(parsed.title.length > 0, true, id);
    assert.equal(parsed.effective.toISOString(), "2026-11-22T00:00:00.000Z");
  }
});

test("the contractual documents name the confirmed operator", () => {
  for (const id of ["terms", "privacy", "complaints"] as const) {
    const { body } = document(id);
    assert.match(body, new RegExp(OPERATOR));
    assert.match(body, new RegExp(COMPANY_NUMBER));
    assert.doesNotMatch(body, /BOOKFOLIO LTD|17260970/);
  }
});

test("the frontmatter requires a title and effective date", () => {
  assert.deepEqual(
    legalSchema.parse({ effective: "2026-10-01", title: "Terms" }),
    {
      effective: new Date("2026-10-01T00:00:00.000Z"),
      title: "Terms",
    },
  );
  assert.throws(() => legalSchema.parse({ title: "Terms" }));
  assert.throws(() =>
    legalSchema.parse({ effective: "2026-10-01", title: "" }),
  );
  assert.throws(() => legalSchema.parse({ effective: "soon", title: "Terms" }));
});

test("the effective date uses the site's readable UTC form", () => {
  assert.deepEqual(effectiveDate(new Date("2026-10-01T00:00:00.000Z")), {
    datetime: "2026-10-01",
    readable: "1 October 2026",
  });
});

test("each legal document links to the other three", () => {
  assert.deepEqual(relatedPolicies("terms"), [
    { label: "Privacy", route: SITE_PATHS.privacy },
    { label: "Complaints", route: SITE_PATHS.complaints },
    { label: "Security", route: SITE_PATHS.security },
  ]);
  for (const id of Object.keys(POLICIES) as PolicyId[]) {
    const related = relatedPolicies(id);
    assert.equal(related.length, 3, id);
    assert.ok(
      related.every((candidate) => candidate.route !== POLICIES[id].route),
    );
  }
});
