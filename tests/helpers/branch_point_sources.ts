import fs from "node:fs/promises";
import path from "node:path";

import type { ComparisonAdditions } from "./comparison_catalogue.js";
import { write } from "./static_changes.js";

type Sources = Record<string, string | null>;
const variant = (slug: string, label: string, movedFrom?: string) => ({
  slug,
  title: slug,
  props: { label },
  ...(movedFrom ? { movedFrom } : {}),
});
const component = (
  title: string,
  element: string,
  variants: ReturnType<typeof variant>[],
  body = "<button>{{label}}</button>",
  movedFrom?: string,
) => `---
title: ${title}
element: ${element}
propSchema: {type: object, additionalProperties: false, properties: {label: {type: string}}}
props: {label: ${title}}
variants: ${JSON.stringify(variants)}
${movedFrom ? `movedFrom: ${movedFrom}\n` : ""}---
${body}`;
const receipt = (moved: boolean) => `---
title: Receipt
${moved ? "movedFrom: branch/consumers/receipt\n" : ""}---
<h1>Receipt</h1><bp-badge label="Paid"></bp-badge>`;

/** Five namespaced base/head scenarios from the branch-point lookup contract. */
function sources(before: boolean): Sources {
  const side = before ? "Before" : "After";
  const consumer = (moved: boolean) =>
    component(
      "Status",
      "bp-status",
      [variant("default", "Active")],
      '<section><bp-badge label="{{label}}"></bp-badge></section>',
      moved ? "branch/consumers/status" : undefined,
    );
  const action = (moved: boolean) =>
    component(
      "Action",
      "bp-action",
      moved
        ? [variant("primary", "Submit")]
        : [variant("primary", "Continue"), variant("secondary", "Cancel")],
      undefined,
      moved ? "branch/parent/action" : undefined,
    );
  const cases = (renamed: boolean) =>
    component(
      "Case action",
      "bp-case-action",
      renamed
        ? [variant("primary", "Submit")]
        : [variant("Primary", "Continue"), variant("secondary", "Cancel")],
    );
  const caseScreen = "---\ntitle: Case receipt\n---\n<h1>Case receipt</h1>";
  return {
    "branch-mark.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><title>${side} branch asset</title><rect width="24" height="24" fill="${before ? "red" : "blue"}"/></svg>`,
    "branch-assets.css":
      '.branch-badge { background-image: url("./branch-mark.svg"); padding: 24px; display: inline-block; }',
    "specs/branch/consumers/badge.component.html": component(
      "Badge",
      "bp-badge",
      [variant("default", "Active")],
      `<span class="branch-badge">${side} {{label}}</span>`,
    ),
    "specs/branch/consumers/status.component.html": before
      ? consumer(false)
      : null,
    "specs/branch/consumers/receipt.screen.html": before
      ? receipt(false)
      : null,
    ...(!before && {
      "specs/branch/consumers/archive/status.component.html": consumer(true),
      "specs/branch/consumers/archive/receipt.screen.html": receipt(true),
    }),
    "specs/branch/parent/action.component.html": before ? action(false) : null,
    ...(!before && {
      "specs/branch/parent/archive/action.component.html": action(true),
    }),
    "specs/branch/variant/donor.component.html": component(
      "Donor",
      "bp-donor",
      before
        ? [variant("primary", "Continue"), variant("spare", "Later")]
        : [variant("spare", "Later")],
    ),
    "specs/branch/variant/receiver.component.html": component(
      "Receiver",
      "bp-receiver",
      [
        variant("default", "Accept"),
        ...(!before
          ? [variant("primary", "Submit", "branch/variant/donor/primary")]
          : []),
      ],
    ),
    "specs/branch/case/Receipt.screen.html": before ? caseScreen : null,
    "specs/branch/case/Action.component.html": before ? cases(false) : null,
    ...(!before && {
      "specs/branch/case/receipt.screen.html": caseScreen,
      "specs/branch/case/action.component.html": cases(true),
    }),
    "specs/branch/reused/action.component.html": before
      ? component("Former action", "bp-former", [variant("default", "Go")])
      : null,
    ...(!before && {
      "specs/branch/reused/action.md":
        "# Action guide\n\nReplacement document\n",
    }),
  };
}

/** Add real sources to either the copied delivery fixture or watched Serve. */
export const addBranchPointSources: ComparisonAdditions = async (
  root,
  side,
) => {
  if (side === "Before") {
    const configuration = JSON.parse(
      await fs.readFile(path.join(root, "mokly.config.json"), "utf8"),
    );
    // Styles resolve resources from their stylesheet, at every consumer depth.
    configuration.stylesheets.unshift(
      { match: "branch/case/**/*.html", stylesheets: [] },
      {
        match: "branch/consumers/**/*.html",
        stylesheets: ["theme.css", "branch-assets.css"],
      },
    );
    await write(root, "mokly.config.json", JSON.stringify(configuration));
  }
  for (const [name, contents] of Object.entries(sources(side === "Before"))) {
    if (contents === null) await fs.rm(path.join(root, name));
    else await write(root, name, contents);
  }
};

/** Stable paths shared by delivery checks and the viewer's Serve journeys. */
export const branchPointPaths = {
  movedScreen: "branch/consumers/archive/receipt",
  previousScreen: "branch/consumers/receipt",
  movedConsumer: "branch/consumers/archive/status/default",
  previousConsumer: "branch/consumers/status/default",
  movedParent: "branch/parent/archive/action",
  movedChild: "branch/parent/archive/action/primary",
  previousChild: "branch/parent/action/primary",
  removedChild: "branch/parent/action/secondary",
  movedVariant: "branch/variant/receiver/primary",
  previousVariant: "branch/variant/donor/primary",
  caseScreen: "branch/case/receipt",
  caseParent: "branch/case/action",
  caseVariant: "branch/case/action/primary",
  caseRemoved: "branch/case/Action/secondary",
  reusedParent: "branch/reused/action",
  reusedRemoved: "branch/reused/action/default",
} as const;
