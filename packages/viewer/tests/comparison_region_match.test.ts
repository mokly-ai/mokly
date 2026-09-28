import assert from "node:assert/strict";
import { test } from "node:test";

import {
  intersectionOverUnion,
  jaccard,
  matchRegion,
  regionScore,
  type RegionFacts,
} from "../src/shell/comparison_region_match.js";
import {
  collectRegions,
  type Box,
} from "../src/shell/comparison_scroll_regions.js";

import {
  asDocument,
  asElement,
  FakeRegionDocument,
  type ElementOptions,
  type FakeElement,
} from "./comparison_region_fakes.js";

/** A region: overflow auto with a hundred pixels of range. */
function region(
  doc: FakeRegionDocument,
  localName = "div",
  attributes: Record<string, string> = {},
  options: ElementOptions = {},
): FakeElement {
  return doc.add(localName, {
    attributes,
    content: { height: 200, width: 100 },
    layout: { height: 100, width: 100 },
    overflow: "auto",
    ...options,
  });
}

function pair(
  source: FakeElement,
  from: FakeRegionDocument,
  to: FakeRegionDocument,
  options: { eligible?(candidate: Element): boolean; facts?: RegionFacts } = {},
) {
  return matchRegion({
    eligible: options.eligible ?? (() => true),
    facts: options.facts ?? {
      box: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
      fingerprint: () => new Set(),
    },
    from: collectRegions(asDocument(from)),
    source: asElement(source),
    to: collectRegions(asDocument(to)),
  });
}

test("an authored name pairs first, even when the ids disagree", () => {
  const before = new FakeRegionDocument();
  const after = new FakeRegionDocument();
  const source = region(before, "div", {
    "data-mokly-scroll": "timeline",
    id: "one",
  });
  region(after, "div", { id: "one" });
  const named = region(after, "div", {
    "data-mokly-scroll": "timeline",
    id: "two",
  });
  after.add("p", { attributes: { "data-mokly-scroll": "timeline" } });
  assert.equal(pair(source, before, after), asElement(named));
});

test("a duplicated or one-sided name falls through to a unique id", () => {
  const before = new FakeRegionDocument();
  const after = new FakeRegionDocument();
  const source = region(before, "div", {
    "data-mokly-scroll": "list",
    id: "x",
  });
  region(after, "div", { "data-mokly-scroll": "list" });
  region(after, "div", { "data-mokly-scroll": "list" });
  const byId = region(after, "div", { id: "x" });
  assert.equal(pair(source, before, after), asElement(byId));

  const lonely = new FakeRegionDocument();
  const one = region(lonely, "div", { "data-mokly-scroll": "only", id: "y" });
  const other = new FakeRegionDocument();
  const target = region(other, "div", { id: "y" });
  assert.equal(pair(one, lonely, other), asElement(target));
});

test("a name duplicated in the source's document is ambiguous too", () => {
  const before = new FakeRegionDocument();
  const after = new FakeRegionDocument();
  const source = region(before, "div", { "data-mokly-scroll": "list" });
  region(before, "div", { "data-mokly-scroll": "list" });
  region(after, "div", { "data-mokly-scroll": "list" });
  assert.equal(pair(source, before, after), undefined);
});

test("a malformed name acts as no name", () => {
  const before = new FakeRegionDocument();
  const after = new FakeRegionDocument();
  const source = region(before, "div", { "data-mokly-scroll": "List" });
  region(after, "div", { "data-mokly-scroll": "List" });
  assert.equal(pair(source, before, after), undefined);
});

test("duplicate ids fall through to a unique role and accessible name", () => {
  const before = new FakeRegionDocument();
  const after = new FakeRegionDocument();
  const source = region(before, "nav", { "aria-label": "Projects", id: "n" });
  region(after, "div", { id: "n" });
  region(after, "div", { id: "n" });
  const landmark = region(after, "div", {
    "aria-label": "Projects",
    role: "navigation",
  });
  assert.equal(pair(source, before, after), asElement(landmark));
});

test("a name only on the source pairs by role and accessible name", () => {
  const before = new FakeRegionDocument();
  const after = new FakeRegionDocument();
  const source = region(before, "main", { "data-mokly-scroll": "content" });
  const main = region(after, "main");
  region(after, "nav", { "aria-label": "Other" });
  assert.equal(pair(source, before, after), asElement(main));
});

test("uniqueness counts ineligible regions, and an ineligible pick skips its rule", () => {
  const before = new FakeRegionDocument();
  const after = new FakeRegionDocument();
  const source = region(before, "main", { id: "panel" });
  const first = region(after, "main", { id: "panel" });
  region(after, "section", { id: "panel" });
  const eligible = (candidate: Element) => candidate !== asElement(first);
  assert.equal(pair(source, before, after, { eligible }), undefined);

  const again = new FakeRegionDocument();
  const pick = region(again, "main", { id: "panel" });
  const fallback = region(again, "div", { role: "main" });
  const onlyFallback = (candidate: Element) => candidate !== asElement(pick);
  assert.equal(
    pair(source, before, again, { eligible: onlyFallback }),
    undefined,
    "role main is held by two regions, so rule 3 is ambiguous too",
  );
  assert.ok(fallback);

  const side = new FakeRegionDocument();
  const nav = region(side, "nav", { "aria-label": "Projects", id: "side" });
  const other = new FakeRegionDocument();
  const taken = region(other, "div", { id: "side" });
  const landmark = region(other, "nav", { "aria-label": "Projects" });
  const free = (candidate: Element) => candidate !== asElement(taken);
  assert.equal(
    pair(nav, side, other, { eligible: free }),
    asElement(landmark),
    "the id's region is taken, so the landmark pairs",
  );
});

test("boxes, words and element names make the fallback score", () => {
  const unit: Box = { bottom: 100, left: 0, right: 100, top: 0 };
  assert.equal(intersectionOverUnion(unit, unit), 1);
  assert.equal(
    intersectionOverUnion(unit, { bottom: 100, left: 0, right: 90, top: 0 }),
    0.9,
  );
  assert.equal(
    intersectionOverUnion(unit, { bottom: 100, left: 100, right: 200, top: 0 }),
    0,
  );
  assert.equal(intersectionOverUnion(unit, { ...unit, right: 0 }), 0);
  const zero: Box = { bottom: 0, left: 0, right: 0, top: 0 };
  assert.equal(intersectionOverUnion(zero, zero), 0);
  assert.equal(jaccard(new Set(["a", "b"]), new Set(["b", "c"])), 1 / 3);
  assert.equal(jaccard(new Set(), new Set()), 0);
  assert.equal(regionScore(0.9, 0, false).toFixed(3), "0.495");
  assert.equal(regionScore(0, 1, false), 0.45);
  assert.equal(regionScore(1, 1, true), 1);
  assert.ok(regionScore(0.19, 0.19, true) < 0.3);
});

/** Candidates whose scores are set through their boxes and words. */
function scored(
  scores: { box: Box; localName?: string; words: string[] }[],
  source: { box: Box; localName?: string; words: string[] },
) {
  const from = new FakeRegionDocument();
  const to = new FakeRegionDocument();
  const origin = region(from, source.localName ?? "div");
  const facts = new Map<unknown, { box: Box; words: Set<string> }>([
    [origin, { box: source.box, words: new Set(source.words) }],
  ]);
  const candidates = scores.map((candidate) => {
    const element = region(to, candidate.localName ?? "section");
    facts.set(element, { box: candidate.box, words: new Set(candidate.words) });
    return element;
  });
  const found = pair(origin, from, to, {
    facts: {
      box: (element) => facts.get(element)!.box,
      fingerprint: (element) => facts.get(element)!.words,
    },
  });
  return candidates.findIndex((candidate) => asElement(candidate) === found);
}

const UNIT: Box = { bottom: 100, left: 0, right: 100, top: 0 };
const NINE: Box = { bottom: 100, left: 0, right: 90, top: 0 };
const AWAY: Box = { bottom: 100, left: 500, right: 600, top: 0 };
const WORDS = ["alpha", "beta", "gamma"];

test("same place with rewritten text pairs unless the runner-up is close", () => {
  const source = { box: UNIT, words: WORDS };
  const weak = { box: AWAY, localName: "div", words: ["alpha", "delta"] };
  assert.equal(scored([{ box: NINE, words: ["x1"] }, weak], source), 0);
  const close = { box: AWAY, localName: "div", words: ["alpha", "beta"] };
  assert.equal(scored([{ box: NINE, words: ["x1"] }, close], source), -1);
});

test("moved with identical text pairs when the runner-up is at most 0.30", () => {
  const source = { box: UNIT, words: WORDS };
  const moved = { box: AWAY, words: WORDS };
  const third = { box: AWAY, words: ["alpha", "beta"] };
  assert.equal(scored([moved, third], source), 0, "runner-up exactly 0.30");
  const closer = { box: AWAY, words: ["alpha", "beta", "gamma", "delta"] };
  assert.equal(scored([moved, closer], source), -1, "runner-up 0.3375");
});

test("ties, small leads and weak scores never pair", () => {
  const source = { box: UNIT, words: WORDS };
  assert.equal(
    scored(
      [
        { box: AWAY, words: WORDS },
        { box: AWAY, words: WORDS },
      ],
      source,
    ),
    -1,
  );
  const lead = { box: AWAY, localName: "div", words: WORDS };
  const near = {
    box: AWAY,
    localName: "div",
    words: ["alpha", "beta", "gamma", "delta"],
  };
  assert.equal(scored([lead, near], source), -1);
  const faint = {
    box: { bottom: 100, left: 81, right: 181, top: 0 },
    localName: "div",
    words: ["alpha", "x1", "x2", "x3", "x4", "x5"],
  };
  assert.equal(scored([faint], source), -1);
  assert.equal(scored([{ box: NINE, words: ["x1"] }], source), 0);
});

test("a source marked off never pairs", () => {
  const before = new FakeRegionDocument();
  const after = new FakeRegionDocument();
  const source = region(before, "main", { "data-mokly-scroll": "off" });
  region(after, "main");
  assert.equal(pair(source, before, after), undefined);
});
