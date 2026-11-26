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

import { attribute, byTag, markupLabel, one } from "./helpers/html.js";
import { builtPage, labelled, namedLinks } from "./helpers/site-output.js";

const POLICY_IDS: readonly PolicyId[] = [
  "terms",
  "privacy",
  "complaints",
  "security",
];

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

test("each legal route has a Markdown source without MDX", () => {
  assert.deepEqual(Object.keys(POLICIES), POLICY_IDS);
  assert.deepEqual(
    readdirSync(sitePath("src", "content", "legal"))
      .filter((name) => name.endsWith(".md"))
      .sort(),
    Object.keys(POLICIES)
      .map((id) => `${id}.md`)
      .sort(),
  );
  for (const id of POLICY_IDS) {
    const { body } = document(id);
    assert.doesNotMatch(body, /<[A-Z][^>]*>/, `${id} contains an MDX tag`);
  }
});

test("every checked-in legal document parses with an effective date", () => {
  for (const id of POLICY_IDS) {
    const parsed = legalSchema.parse(document(id).frontmatter);
    assert.equal(parsed.title.length > 0, true, id);
    assert.equal(parsed.effective.toISOString(), "2026-11-22T00:00:00.000Z");
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
  for (const id of POLICY_IDS) {
    const related = relatedPolicies(id);
    assert.equal(related.length, 3, id);
    assert.ok(
      related.every((candidate) => candidate.route !== POLICIES[id].route),
    );
  }
});

for (const id of POLICY_IDS) {
  const { route } = POLICIES[id];
  test(`${route} publishes its Markdown, effective date and related policy links`, () => {
    const { body, frontmatter } = document(id);
    const { effective } = legalSchema.parse(frontmatter);
    const date = effectiveDate(effective);
    const page = builtPage(route);
    const expectedSection = /^## (.+)$/m.exec(body)?.[1];
    const [section] = byTag(one(page, "site-policy-body"), "h2");
    assert.ok(section && expectedSection, "first Markdown section");
    assert.equal(
      markupLabel(section),
      expectedSection,
      "rendered first section",
    );

    const times = byTag(one(page, "site-policy-date"), "time");
    assert.deepEqual(
      times.map((time) => [attribute(time, "datetime"), markupLabel(time)]),
      [[date.datetime, date.readable]],
      "published effective date",
    );

    const [navigation] = labelled(page, "nav", "Legal documents");
    assert.ok(navigation, "legal documents navigation");
    assert.deepEqual(
      namedLinks(navigation),
      relatedPolicies(id).map(({ label, route }) => [label, route]),
      "related legal documents",
    );
  });
}
