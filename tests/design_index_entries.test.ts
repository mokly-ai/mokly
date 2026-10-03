import assert from "node:assert/strict";
import { test } from "node:test";

import { entryRoute } from "../packages/viewer/dist/data.js";

import {
  attribute,
  byClass,
  designDocument,
  elements,
  textContent,
  type Element,
} from "./helpers/design_catalogue.js";
import {
  filterTargets,
  headCrumbs,
  headTitle,
  rowIcon,
  rowLabel,
  variantToggles,
} from "./helpers/design_rows.js";

const SCREEN = "design/browse/index-entries/screen";
const MEMBER = "design/browse/index-entries/member";
const SCREEN_CHANGES = "design/browse/index-entries/screen-changes";
const MEMBER_CHANGES = "design/browse/index-entries/member-changes";
const HOME_CRUMB = ["Catalogue home", "design/browse/views/home"];

type Node = Parameters<typeof byClass>[0];

/** The rows that follow the Profile row, up to the next top-level folder. */
function profileList(document: Node): Element[] {
  const rows = byClass(document, "mbk-nav-row");
  const start = rows.findIndex((row) => rowLabel(row) === "Profile");
  assert.ok(start >= 0, "missing Profile row");
  const end = rows.findIndex(
    (row, index) => index > start && rowLabel(row) === "Design",
  );
  return rows.slice(start + 1, end === -1 ? undefined : end);
}

function row(document: Node, label: string): Element {
  const found = byClass(document, "mbk-nav-row").find(
    (candidate) => rowLabel(candidate) === label,
  );
  assert.ok(found, `missing row ${label}`);
  return found;
}

function profileToggle(document: Node): Element {
  const toggles = variantToggles(document).filter((toggle) =>
    attribute(toggle, "aria-label")?.endsWith("of Profile"),
  );
  assert.equal(toggles.length, 1);
  return toggles[0]!;
}

function changedMarks(node: Element): number {
  return byClass(node, "mbk-nav-changed").length;
}

/** The viewport option a state selects, and the marks on its control. */
function viewportSelection(document: Node) {
  const control = byClass(document, "ce-viewport-control")[0];
  assert.ok(control, "missing viewport control");
  const selected = elements(
    control,
    (node) =>
      node.tagName === "option" && attribute(node, "selected") !== undefined,
  );
  assert.equal(selected.length, 1);
  return {
    marks: byClass(control, "ce-view-changed").length,
    selected: attribute(selected[0]!, "value"),
  };
}

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: index entry states render as light-only shells with path chips`, async () => {
    for (const [id, title, path] of [
      [SCREEN, "Profile", "account/profile"],
      [MEMBER, "Security", "account/profile/security"],
      [SCREEN_CHANGES, "Profile", "account/profile"],
      [MEMBER_CHANGES, "Security", "account/profile/security"],
    ] as const) {
      const { entry, document } = await designDocument(id, viewport);
      assert.equal(entryRoute(entry.path), `${id}/index.html`);
      assert.deepEqual(entry.colorSchemes, ["light"], id);
      assert.equal(byClass(document, "mbk-shell").length, 1, id);
      assert.equal(headTitle(document), title, id);
      assert.equal(
        textContent(byClass(document, "mbk-pathchip")[0]!).trim(),
        path,
        id,
      );
    }
  });

  test(`${viewport}: a member's breadcrumbs end in its folder's screen`, async () => {
    const screen = await designDocument(SCREEN, viewport);
    assert.deepEqual(headCrumbs(screen.document), [
      HOME_CRUMB,
      ["Account", undefined],
    ]);
    const member = await designDocument(MEMBER, viewport);
    assert.deepEqual(headCrumbs(member.document), [
      HOME_CRUMB,
      ["Account", undefined],
      ["Profile", SCREEN],
    ]);
    const changed = await designDocument(MEMBER_CHANGES, viewport);
    assert.deepEqual(headCrumbs(changed.document), [
      HOME_CRUMB,
      ["Account", undefined],
      ["Profile", undefined],
    ]);
  });

  test(`${viewport}: Changes states carry status and the changed member's band`, async () => {
    const container = await designDocument(SCREEN_CHANGES, viewport);
    assert.match(textContent(container.document), /Unmodified/);
    assert.equal(byClass(container.document, "mbk-cmp-toolbar").length, 0);
    const member = await designDocument(MEMBER_CHANGES, viewport);
    assert.match(textContent(member.document), /Changed/);
    const toolbar = byClass(member.document, "mbk-cmp-toolbar")[0];
    assert.ok(toolbar);
    assert.deepEqual(
      elements(toolbar, (node) => node.tagName === "a"),
      [],
    );
  });

  test(`${viewport}: the first changed member opens on its first changed view`, async () => {
    const member = await designDocument(MEMBER_CHANGES, viewport);
    assert.deepEqual(viewportSelection(member.document), {
      marks: 1,
      selected: "mobile",
    });
    const appearance = byClass(member.document, "mbk-appearance")[0];
    assert.ok(appearance);
    assert.equal(byClass(appearance, "mbk-view-changed").length, 0);
    const container = await designDocument(SCREEN_CHANGES, viewport);
    assert.deepEqual(viewportSelection(container.document), {
      marks: 0,
      selected: viewport === "mobile" ? "mobile" : "both",
    });
  });
}

test("the folder's screen row is a link beside a contents disclosure listing variants, then members", async () => {
  const { document } = await designDocument(SCREEN, "desktop");
  const profile = row(document, "Profile");
  assert.equal(profile.tagName, "a");
  assert.equal(attribute(profile, "data-mokly-link"), SCREEN);
  assert.equal(attribute(profile, "aria-current"), "page");
  const leaf = byClass(document, "mbk-nav-leaf").find((candidate) =>
    byClass(candidate, "mbk-nav-row").includes(profile),
  );
  assert.ok(leaf, "the Profile row and its disclosure share one leaf");
  const toggle = profileToggle(document);
  assert.equal(attribute(toggle, "aria-label"), "Hide contents of Profile");
  assert.equal(attribute(toggle, "aria-expanded"), "true");
  assert.deepEqual(profileList(document).map(rowLabel), [
    "Unverified email",
    "Notifications",
    "Security",
  ]);
  assert.equal(rowIcon(document, "Unverified email")[0], "mbk-nav-ico variant");
  assert.equal(rowIcon(document, "Notifications")[0], "mbk-nav-ico");
  assert.equal(attribute(row(document, "Security"), "data-mokly-link"), MEMBER);
  assert.equal(row(document, "Notifications").tagName, "span");
  assert.equal(row(document, "Unverified email").tagName, "span");
  assert.deepEqual(filterTargets(document), [["Changes1", SCREEN_CHANGES]]);
});

test("a member keeps its folder screen's list open and changes to its own Changes state", async () => {
  const { document } = await designDocument(MEMBER, "desktop");
  assert.equal(attribute(row(document, "Security"), "aria-current"), "page");
  assert.equal(attribute(row(document, "Profile"), "data-mokly-link"), SCREEN);
  assert.equal(
    attribute(profileToggle(document), "aria-label"),
    "Hide contents of Profile",
  );
  assert.deepEqual(filterTargets(document), [["Changes1", MEMBER_CHANGES]]);
});

test("in Changes the unmodified folder screen is an undotted container that opens its first changed member", async () => {
  for (const [id, active] of [
    [SCREEN_CHANGES, "Profile"],
    [MEMBER_CHANGES, "Security"],
  ] as const) {
    const { document } = await designDocument(id, "desktop");
    assert.deepEqual(
      byClass(document, "mbk-nav-row").map(rowLabel),
      ["Account", "Profile", "Security"],
      id,
    );
    const profile = row(document, "Profile");
    const security = row(document, "Security");
    assert.equal(changedMarks(profile), 0, `${id}: Profile has no dot`);
    assert.equal(changedMarks(security), 1, `${id}: Security is changed`);
    assert.equal(attribute(profile, "data-mokly-link"), MEMBER_CHANGES, id);
    assert.equal(attribute(security, "data-mokly-link"), MEMBER_CHANGES, id);
    assert.equal(attribute(row(document, active), "aria-current"), "page", id);
    assert.equal(
      attribute(profileToggle(document), "aria-label"),
      "Hide contents of Profile",
      id,
    );
  }
  assert.deepEqual(
    filterTargets((await designDocument(SCREEN_CHANGES, "desktop")).document),
    [["All", SCREEN]],
  );
  assert.deepEqual(
    filterTargets((await designDocument(MEMBER_CHANGES, "desktop")).document),
    [["All", MEMBER]],
  );
});

test("the canonical tree keeps the Profile list collapsed and links its row", async () => {
  const { document } = await designDocument(
    "design/browse/views/home",
    "desktop",
  );
  const toggle = profileToggle(document);
  assert.equal(attribute(toggle, "aria-label"), "Show contents of Profile");
  assert.equal(attribute(toggle, "aria-expanded"), "false");
  assert.equal(attribute(row(document, "Profile"), "data-mokly-link"), SCREEN);
  assert.deepEqual(profileList(document).map(rowLabel), []);
});
