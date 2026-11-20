/**
 * The waits of the settings panes' own reads. While a pane reads its own data,
 * it draws its own layout, as the Wait composition in `folio-chrome.md`
 * defines: section headings stay, a heading that only a non-empty list shows
 * is a bar, each list draws one placeholder row in its own frame, facts keep
 * their labels over value bars, every control of the waiting region draws its
 * placeholder form, and the read is named once. The waits of the settings
 * scope are in `settings-scope-waits.test.ts`.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { githubAccounts, sample, token, workspace } from "../fixtures/product";
import { billing, membership } from "../fixtures/product-states";

import type { Viewport } from "./catalogue-paths";
import {
  attribute,
  byClass,
  childElements,
  elements,
  label,
} from "./design-site-test-helpers";
import {
  actions,
  buttonsIn,
  destination,
  drawnPage,
  facts,
  links,
  pendingLabels,
  placeholderRows,
  sectionHeadings,
  waitRegion,
} from "./drawn-page";

const viewports: readonly Viewport[] = ["desktop", "mobile"];
const people = membership.active.map((person) => person.email);

/**
 * Each pane read: what screen readers and sighted readers hear, the pane's
 * section headings in order (a bar reads as ""), how many placeholder rows
 * its lists draw, the region's controls that draw themselves disabled, how
 * many control placeholders and waiting fields it holds, and the answer's
 * values that the wait must not show.
 */
const waits = [
  {
    wait: "product/settings/workspace/loading",
    heard: ["Loading projects…", "screen-reader-only"],
    headings: ["Projects"],
    rows: 1,
    disabled: [],
    placeholders: 0,
    fields: 0,
    hidden: workspace.projects.map((project) => project.repository),
  },
  {
    wait: "product/settings/github/loading",
    heard: ["Loading GitHub accounts…", "screen-reader-only"],
    headings: [""],
    rows: 1,
    disabled: [],
    placeholders: 2,
    fields: 0,
    hidden: [
      ...githubAccounts.map((account) => account.name),
      "Connected accounts",
      "Add GitHub account",
    ],
  },
  {
    wait: "product/settings/members/loading",
    heard: ["Loading members…", "screen-reader-only"],
    headings: ["People in Mokly", "Invitations", "Invite to Mokly"],
    rows: 2,
    // Only an invitation's row shows its badge and Revoke invitation, and the
    // list is often empty, so both wait as placeholders in their own boxes.
    disabled: ["Manage", "Send invitation"],
    placeholders: 2,
    fields: 1,
    hidden: [
      ...people,
      membership.invited.email,
      billing.collaborators.seat,
      "Manage Sam",
      "Invited",
      "Revoke invitation",
    ],
  },
  {
    wait: "product/settings/billing/loading",
    heard: ["Loading billing…", "visible"],
    headings: [],
    rows: 0,
    disabled: [],
    placeholders: 1,
    fields: 0,
    hidden: [billing.plan, billing.total, billing.renews, "Manage billing"],
  },
  {
    wait: "product/settings/billing/confirming",
    heard: ["Confirming your subscription…", "visible"],
    headings: [],
    rows: 0,
    disabled: [],
    placeholders: 1,
    fields: 0,
    hidden: [billing.plan, billing.total, billing.renews, "Manage billing"],
  },
  {
    wait: "product/settings/tokens/loading",
    heard: ["Loading publishing tokens…", "screen-reader-only"],
    headings: [""],
    rows: 1,
    disabled: [],
    placeholders: 3,
    fields: 0,
    hidden: [token.name, token.prefix, "Active", "Create token"],
  },
  {
    wait: "product/settings/access/loading",
    heard: ["Loading project access…", "screen-reader-only"],
    headings: ["From Mokly", "Project grants"],
    rows: 2,
    disabled: ["Manage members"],
    placeholders: 0,
    fields: 0,
    hidden: [...people, membership.selected.email, "Owner", "Reviewer"],
  },
] as const;

test("a settings pane's read draws the pane's own layout and names it once", () => {
  for (const viewport of viewports)
    for (const entry of waits) {
      const where = entry.wait + " " + viewport;
      const page = drawnPage(entry.wait, viewport);
      assert.deepEqual(pendingLabels(page), [entry.heard], where);
      const held = waitRegion(page, where);
      // The old block is gone: nothing stands for the pane but the pane.
      for (const old of ["fo-pending", "fo-pending-shape"])
        assert.equal(byClass(page.main, old).length, 0, where + " " + old);
      assert.deepEqual(sectionHeadings(page.main), entry.headings, where);
      assert.equal(placeholderRows(held).length, entry.rows, where);
      // Every control the read's region holds draws its placeholder form: a
      // known label draws itself disabled, and nothing in it leads anywhere.
      assert.deepEqual(buttonsIn(held).map(label), entry.disabled, where);
      for (const button of buttonsIn(held))
        assert.equal(attribute(button, "aria-disabled"), "true", where);
      assert.deepEqual(
        elements(held, (element) => element.tagName === "a").map(label),
        [],
        where,
      );
      assert.equal(
        byClass(held, "fo-wait-control").length,
        entry.placeholders,
        where,
      );
      assert.equal(byClass(held, "fo-wait-input").length, entry.fields, where);
      for (const value of entry.hidden)
        assert.ok(!label(held).includes(value), where + " shows " + value);
    }
});

test("billing names its read in the plan's place and keeps every fact's label", () => {
  const loaded = facts(drawnPage("product/settings/billing")).map(
    ([term]) => term,
  );
  assert.deepEqual(loaded, [
    "Plan",
    "Editors",
    "Collaborators",
    "Monthly total",
    "Renews",
  ]);
  for (const viewport of viewports)
    for (const [id, name] of [
      ["product/settings/billing/loading", "Loading billing…"],
      ["product/settings/billing/confirming", "Confirming your subscription…"],
    ] as const)
      assert.deepEqual(
        facts(drawnPage(id, viewport)),
        loaded.map((term) => [term, term === "Plan" ? name : ""]),
        id + " " + viewport,
      );
});

test("the Workspace pane keeps what it knows while its lists load", () => {
  for (const viewport of viewports) {
    const where = "product/settings/workspace/loading " + viewport;
    const page = drawnPage("product/settings/workspace/loading", viewport);
    const held = waitRegion(page, where);
    // Only the projects list waits for the projects read, under its heading.
    assert.deepEqual(
      childElements(held).map((part) => attribute(part, "class")),
      ["fo-pending-label fo-sr-only", "fo-panel"],
      where,
    );
    assert.deepEqual(
      facts(page),
      [
        ["Plan", billing.plan],
        ["Slug", workspace.slug + "Change"],
        ["GitHub accounts", "Loading GitHub accountsManage"],
      ],
      where,
    );
    const name = elements(
      page.main,
      (element) => attribute(element, "id") === "workspace-name",
    );
    assert.deepEqual(
      name.map((field) => attribute(field, "value")),
      [sample.workspace],
      where,
    );
    assert.deepEqual(
      links(page, "Create project").map(destination),
      ["product/account/choose-repository"],
      where,
    );
    assert.deepEqual(actions(page).slice(-3), [
      ["quiet", "Manage"],
      ["primary", "Save changes"],
      ["secondary", "Create project"],
    ]);
  }
});
