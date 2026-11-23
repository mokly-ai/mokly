import assert from "node:assert/strict";
import { test } from "node:test";

import type { RenderResult } from "@testing-library/react";

import {
  changeHomeUsage,
  DOCUMENT_KEY,
  HOME,
  homeDetail,
  homeScreen,
  publication,
  RETIRED,
  USAGE_DETAIL_ID,
} from "./refresh_publication_fixtures.js";
import {
  registerShellDocument,
  renderPublicationShell,
} from "./refresh_shell_fixture.js";

test("the published navigation and stage match a fresh render", async (t) => {
  registerShellDocument(t);
  const initial = publication(0, (index) => {
    index.changesStatus = "pending";
  });
  const shell = await renderPublicationShell(initial, [homeDetail(0)]);
  assert.equal(
    rail(shell.view)
      .querySelector("[data-changes-status]")
      ?.getAttribute("data-changes-status"),
    "pending",
  );
  await shell.publish(
    publication(1, (index) => {
      homeScreen(index).title = "Updated home";
    }),
    homeDetail(1),
  );

  const final = publication(2, (index) => {
    const entry = homeScreen(index);
    entry.title = "Updated home";
    entry.detailId = USAGE_DETAIL_ID;
    entry.views[0]!.documentKey = DOCUMENT_KEY;
    entry.changes = { status: "ready", included: false, kind: "unmodified" };
    index.removedEntries = index.removedEntries.filter(
      ({ snapshotId }) => snapshotId !== RETIRED.snapshotId,
    );
  });
  const finalDetail = homeDetail(2, changeHomeUsage);
  await shell.publish(final, finalDetail);
  const rebuilt = await renderPublicationShell(structuredClone(final), [
    structuredClone(finalDetail),
  ]);

  assert.match(
    rail(shell.view).querySelector(`[data-entry-id="${HOME}"]`)?.textContent ??
      "",
    /^Updated home/,
  );
  assert.deepStrictEqual(
    domValues(stage(shell.view)),
    domValues(stage(rebuilt.view)),
  );
  assert.deepStrictEqual(
    domValues(rail(shell.view)),
    domValues(rail(rebuilt.view)),
  );
});

function rail({ container }: RenderResult): HTMLElement {
  const nav = container.querySelector<HTMLElement>("nav[data-mokly-nav]");
  assert.ok(nav);
  return nav;
}

function stage({ container }: RenderResult): Element {
  const stage = container.querySelector("[data-mokly-stage]");
  assert.ok(stage);
  assert.equal(stage.querySelectorAll("iframe").length, 2);
  return stage;
}

type DomValues =
  | { name: string; value: string | null }
  | { name: string; attributes: Record<string, string>; children: DomValues[] };

function domValues(node: Node): DomValues {
  return node instanceof Element
    ? {
        name: node.tagName,
        attributes: Object.fromEntries(
          Array.from(node.attributes, ({ name, value }) => [name, value]),
        ),
        children: Array.from(node.childNodes, domValues),
      }
    : { name: node.nodeName, value: node.nodeValue };
}
