import assert from "node:assert/strict";
import { test } from "node:test";

import { act, fireEvent } from "@testing-library/react";

import { flush } from "./data_fakes.js";
import { richDetails } from "./reader_unknown_fixtures.js";
import {
  changeHomeUsage,
  DOCUMENT_KEY,
  HOME,
  homeDetail,
  homeScreen,
  publication,
  USAGE_DETAIL_ID,
} from "./refresh_publication_fixtures.js";
import {
  registerShellDocument,
  renderPublicationShell,
} from "./refresh_shell_fixture.js";

test("a publication keeps the rail scroll when the routed record is rebound", async (t) => {
  registerShellDocument(t);
  const shell = await renderPublicationShell(publication(0), [homeDetail(0)]);
  const current = shell.view.container.querySelector<HTMLAnchorElement>(
    `a[data-entry-id="${HOME}"][aria-current="page"]`,
  );
  assert.ok(current);
  const scroll = t.mock.method(current, "scrollIntoView", () => {});

  await shell.publish(publication(1), homeDetail(1));
  await shell.publish(
    publication(2, (index) => {
      homeScreen(index).title = "Updated home";
    }),
    homeDetail(2),
  );

  assert.match(current.textContent, /^Updated home/);
  assert.equal(scroll.mock.callCount(), 0);
});

test("a publication that restores a missing route keeps the rail scroll", async (t) => {
  registerShellDocument(t, "/view/guide/");
  const initial = publication(0, (index) => {
    index.pages = [];
    index.tree = index.tree.filter(({ path }) => path !== "guide");
  });
  const shell = await renderPublicationShell(initial, []);
  const scroll = t.mock.method(
    HTMLAnchorElement.prototype,
    "scrollIntoView",
    () => {},
  );

  await shell.publish(publication(1));

  const current = shell.view.container.querySelector(
    'a[data-entry-id="guide"][aria-current="page"]',
  );
  assert.match(current?.textContent ?? "", /^Guide/);
  assert.equal(scroll.mock.callCount(), 0);
});

const EVIDENCE_DETAIL_ID = "e".repeat(64);

test("a publication updates only changed usage and remounts only a changed document", async (t) => {
  registerShellDocument(t);
  const shell = await renderPublicationShell(publication(0), [homeDetail(0)]);
  const mobile = shell.mounts.find(
    ({ frame }) => frame.dataset.workspaceFrame === "mobile",
  )!;
  const desktop = shell.mounts.find(
    ({ frame }) => frame.dataset.workspaceFrame === "desktop",
  )!;
  const effects = () => ({
    mounts: shell.mounts
      .map(({ frame }) => frame.dataset.workspaceFrame)
      .sort(),
    mobile: mobile.updates.map(({ status }) => status),
    desktop: desktop.updates.map(({ status }) => status),
  });
  const observed = [];

  await shell.publish(publication(1), homeDetail(1));
  observed.push(effects());
  await shell.publish(
    publication(2, (index) => {
      homeScreen(index).detailId = EVIDENCE_DETAIL_ID;
    }),
    homeDetail(2, (detail) => {
      detail.detailId = EVIDENCE_DETAIL_ID;
      detail.views[0]!.state = "unchanged";
    }),
  );
  observed.push(effects());
  await shell.publish(
    publication(3, (index) => {
      homeScreen(index).detailId = USAGE_DETAIL_ID;
    }),
    homeDetail(3, changeHomeUsage),
  );
  observed.push(effects());
  await shell.publish(
    publication(4, (index) => {
      const screen = homeScreen(index);
      screen.detailId = USAGE_DETAIL_ID;
      screen.views[1]!.documentKey = DOCUMENT_KEY;
    }),
    homeDetail(4, changeHomeUsage),
  );
  observed.push(effects());

  assert.deepStrictEqual(observed, [
    { mounts: ["desktop", "mobile"], mobile: [], desktop: [] },
    { mounts: ["desktop", "mobile"], mobile: [], desktop: [] },
    { mounts: ["desktop", "mobile"], mobile: ["pending"], desktop: [] },
    {
      mounts: ["desktop", "desktop", "mobile"],
      mobile: ["pending"],
      desktop: [],
    },
  ]);
  assert.equal(mobile.frame.isConnected, true);
  assert.equal(desktop.frame.isConnected, false);
});

test("equal usage keeps an active highlight and selected instance during a publication", async (t) => {
  registerShellDocument(t);
  const detail = richDetails().find(({ entry }) => entry.path === HOME)!;
  detail.detailId = USAGE_DETAIL_ID;
  const indexAt = (revision: number) =>
    publication(revision, (index) => {
      homeScreen(index).detailId = detail.detailId;
    });
  const key = "a1".repeat(32);
  const shell = await renderPublicationShell(
    indexAt(0),
    [[{ path: HOME }, detail]],
    [
      {
        key,
        ranges: [{ id: "r-0", boxes: [{ x: 4, y: 8, width: 20, height: 16 }] }],
      },
    ],
  );
  const desktop = shell.mounts.find(
    ({ frame }) => frame.dataset.workspaceFrame === "desktop",
  )!;
  const toggle = shell.view.getByRole("button", {
    name: "Highlight components",
  });

  await act(async () => {
    fireEvent.click(toggle);
    await flush();
  });
  await act(async () => {
    desktop.receive?.({ type: "click", key, boxes: [] });
    await flush();
  });
  assert.equal(toggle.getAttribute("aria-pressed"), "true");
  assert.deepStrictEqual(desktop.highlighted, [key]);
  assert.equal(
    shell.view.getByRole("heading", { name: "Action · action" }).textContent,
    "Action · action",
  );

  await shell.publish(indexAt(1), [
    { path: HOME },
    { ...structuredClone(detail), revision: 1 },
  ]);

  assert.equal(toggle.getAttribute("aria-pressed"), "true");
  assert.deepStrictEqual(desktop.highlighted, [key]);
  assert.equal(
    shell.view.getByRole("heading", { name: "Action · action" }).textContent,
    "Action · action",
  );
  assert.deepStrictEqual(
    desktop.clearedOnUpdate.flat(),
    [],
    "the probe cleared the active highlight during the publication",
  );
});
