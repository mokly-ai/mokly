import assert from "node:assert/strict";
import { test } from "node:test";

import {
  accessibleName,
  authoredName,
  isScrollOff,
  regionId,
  regionRole,
  regionRoleKey,
  textFingerprint,
} from "../src/shell/comparison_region_identity.js";

import {
  asElement,
  FakeRegionDocument,
  type ElementOptions,
} from "./comparison_region_fakes.js";

function element(localName: string, options: ElementOptions = {}) {
  return asElement(new FakeRegionDocument().add(localName, options));
}

function named(value: string) {
  return element("div", { attributes: { "data-mokly-scroll": value } });
}

test("authored names follow the public id grammar and off pairs nothing", () => {
  for (const valid of ["main", "side-list", "panel-2", "a1-b2-c3"])
    assert.equal(authoredName(named(valid)), valid, valid);
  for (const invalid of [
    "",
    " main",
    "main ",
    "Main",
    "side_list",
    "side--list",
    "-side",
    "side-",
    "off",
  ])
    assert.equal(authoredName(named(invalid)), undefined, `"${invalid}"`);
  assert.equal(isScrollOff(named("off")), true);
  assert.equal(isScrollOff(named("Off")), false);
  assert.equal(isScrollOff(element("div")), false);
});

test("an id counts only when it is not empty", () => {
  assert.equal(
    regionId(element("div", { attributes: { id: "list" } })),
    "list",
  );
  assert.equal(regionId(element("div", { attributes: { id: "" } })), undefined);
  assert.equal(regionId(element("div")), undefined);
});

test("supported explicit roles win and unsupported ones have no role", () => {
  const role = (value: string, localName = "div") =>
    regionRole(element(localName, { attributes: { role: value } }));
  assert.equal(role("navigation"), "navigation");
  assert.equal(role("  LIST  extra"), "list");
  assert.equal(role("Main"), "main");
  assert.equal(role("button", "main"), undefined);
  assert.equal(role("heading"), undefined);
  assert.equal(role("   ", "nav"), "navigation");
  assert.equal(role("", "aside"), "complementary");
});

test("implicit roles come from the element name", () => {
  const cases: [string, string | undefined][] = [
    ["main", "main"],
    ["nav", "navigation"],
    ["aside", "complementary"],
    ["dialog", "dialog"],
    ["ol", "list"],
    ["ul", "list"],
    ["menu", "list"],
    ["table", "table"],
    ["div", undefined],
    ["article", undefined],
    ["constructor", undefined],
  ];
  for (const [localName, role] of cases)
    assert.equal(regionRole(element(localName)), role, localName);
  assert.equal(regionRole(element("section")), undefined);
  assert.equal(
    regionRole(element("section", { attributes: { "aria-label": "Feed" } })),
    "region",
  );
});

test("accessible names collapse whitespace, including an empty label", () => {
  const doc = new FakeRegionDocument();
  doc.add("h2", { attributes: { id: "first" }, text: "  Recent\n projects " });
  doc.add("p", { attributes: { id: "second" }, text: "and\tdrafts" });
  const labelled = (attributes: Record<string, string>) =>
    accessibleName(asElement(doc.add("nav", { attributes })));
  assert.equal(labelled({ "aria-label": "  Main \n menu " }), "Main menu");
  assert.equal(labelled({ "aria-label": "   " }), "");
  assert.equal(
    labelled({ "aria-label": "Wins", "aria-labelledby": "first" }),
    "Wins",
  );
  assert.equal(
    labelled({ "aria-labelledby": " first missing second " }),
    "Recent projects and drafts",
  );
  assert.equal(labelled({}), "");
  assert.equal(
    regionRoleKey(
      asElement(doc.add("nav", { attributes: { "aria-label": "A" } })),
    ),
    "navigation\u0000A",
  );
  assert.equal(regionRoleKey(asElement(doc.add("main"))), "main\u0000");
  assert.equal(regionRoleKey(asElement(doc.add("div"))), undefined);
});

test("a fingerprint keeps heading words, then the first 200 words", () => {
  const doc = new FakeRegionDocument();
  const region = doc.add("div", { text: "Intro " });
  region.add("h3", { text: "Quarterly Numbers " });
  region.add("p", {
    attributes: { role: "heading" },
    text: "Überblick 2026 ",
  });
  region.add("p", { text: "a b c ÉTÉ été  x9 42 " });
  assert.deepEqual(
    [...textFingerprint(asElement(region))].sort(),
    [
      "2026",
      "42",
      "intro",
      "numbers",
      "quarterly",
      "x9",
      "überblick",
      "été",
    ].sort(),
  );
  const long = doc.add("div", {
    text: Array.from({ length: 250 }, (_, index) => `w${index}`).join(" "),
  });
  const words = textFingerprint(asElement(long));
  assert.equal(words.size, 200);
  assert.equal(words.has("w199"), true);
  assert.equal(words.has("w200"), false);
});

test("short words still count towards the first 200", () => {
  const doc = new FakeRegionDocument();
  const region = doc.add("div", {
    text: `${Array.from({ length: 199 }, () => "a").join(" ")} kept dropped`,
  });
  assert.deepEqual([...textFingerprint(asElement(region))], ["kept"]);
});
