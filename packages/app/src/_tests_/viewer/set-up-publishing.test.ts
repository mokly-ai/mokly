import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

import { createElement } from "react";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { Project } from "../../api/types";
import { icons } from "../../components/icons";
import { site } from "../../config";
import { tabAt, withWindow } from "../page-window";
import { forget, seen } from "../press-doubles";
import type { DrawnButton } from "../press-doubles";

// The package Button and Expo Router resolve to the doubles before any card
// loads, so a card can be rendered and its press taken in Node. The hook
// belongs to this file's own test process.
const doubles = new URL("../press-doubles.ts", import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@firna/ui/button" || specifier === "expo-router")
      return { url: doubles, shortCircuit: true };
    return next(specifier, context);
  },
});

/** The three cards that offer Set up publishing, loaded through the doubles. */
async function cards() {
  const { SetUpPublishing } = await import("../../viewer/stage");
  const { NoBranches } = await import("../../viewer/panels/switcher");
  const { NoPublication } = await import("../../viewer/panels/share");
  return { SetUpPublishing, NoBranches, NoPublication };
}

const project: Project = {
  id: "project",
  workspaceId: "workspace",
  workspaceSlug: "acme",
  name: "Website",
  slug: "website",
  repository: "acme/website",
  configPath: "mokly.config.json",
  visibility: "public",
  requireApproval: false,
  canAdmin: true,
  publishingAllowed: true,
  automaticBuilds: false,
  buildsAvailable: false,
  canRequestBuilds: false,
  version: 1,
};

/** Each card that offers an administrator Set up publishing, by its surface. */
async function offered() {
  const { SetUpPublishing, NoBranches, NoPublication } = await cards();
  return [
    ["stage", createElement(SetUpPublishing, { project, onChoose: () => {} })],
    [
      "switcher",
      createElement(NoBranches, { setUpPublishing: site.publishFromCi }),
    ],
    [
      "share",
      createElement(NoPublication, { setUpPublishing: site.publishFromCi }),
    ],
  ] as const;
}

/** Render one card and return its Set up publishing Button, if it draws one. */
function drawSetUpPublishing(card: ReactElement): DrawnButton | undefined {
  forget();
  renderToStaticMarkup(card);
  return seen.buttons.find((button) => button.label === "Set up publishing");
}

/**
 * Render one card and press its Set up publishing action in a browser tab, then
 * report where the press went: the addresses this tab was sent to, and the
 * routes the router was asked for. `undefined` means the card offers no such
 * action.
 */
function pressSetUpPublishing(
  card: ReactElement,
): { assigned: string[]; pushed: string[] } | undefined {
  const action = drawSetUpPublishing(card);
  if (!action) return undefined;
  const assigned: string[] = [];
  const location = {
    ...tabAt("http://localhost:8081/acme/website"),
    assign: (address: string) => void assigned.push(address),
  };
  withWindow({ location }, () => action.onPress?.());
  return { assigned, pushed: [...seen.pushed] };
}

test("every Set up publishing action opens the CI setup guide in this tab", async () => {
  for (const [card, element] of await offered()) {
    assert.deepEqual(
      pressSetUpPublishing(element),
      { assigned: [site.publishFromCi], pushed: [] },
      card,
    );
  }
});

test("every Set up publishing action draws the external glyph", async () => {
  for (const [card, element] of await offered()) {
    assert.equal(drawSetUpPublishing(element)?.icon, icons.external, card);
  }
});

test("a Set up publishing address that would run in the page is never followed", async () => {
  const { NoBranches, NoPublication } = await cards();
  for (const address of [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "vbscript:msgbox(1)",
    "data:text/html,<p>hi</p>",
  ]) {
    for (const card of [NoBranches, NoPublication]) {
      assert.deepEqual(
        pressSetUpPublishing(createElement(card, { setUpPublishing: address })),
        { assigned: [], pushed: [] },
        card.name + " " + address,
      );
    }
  }
});

test("a reader who does not administer the project is offered no way to publish", async () => {
  const { SetUpPublishing, NoBranches, NoPublication } = await cards();
  const member = { ...project, canAdmin: false };
  assert.equal(
    pressSetUpPublishing(
      createElement(SetUpPublishing, { project: member, onChoose: () => {} }),
    ),
    undefined,
  );
  // The stage still offers the one thing a member can do.
  assert.deepEqual(
    seen.buttons.map((button) => button.label),
    ["Choose another branch"],
  );
  assert.equal(pressSetUpPublishing(createElement(NoBranches, {})), undefined);
  assert.equal(
    pressSetUpPublishing(createElement(NoPublication, {})),
    undefined,
  );
});
