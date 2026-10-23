import fs from "node:fs/promises";
import path from "node:path";

import type { ComparisonAdditions } from "./comparison_catalogue.js";
import { write } from "./static_changes.js";

const source = (metadata: Record<string, unknown>, body: string) =>
  `---\n${JSON.stringify(metadata)}\n---\n${body}`;
const schema = (property: string) => ({
  type: "object",
  additionalProperties: false,
  properties: { [property]: { type: "string" } },
});
const previous = "branch/moves/previous";
const current = "branch/moves/current";

/** Names used by copied delivery checks and the viewer's moved-entry journeys. */
export const movedFixturePaths = {
  pureMovedScreen: `${current}/receipt`,
  movedAction: `${current}/action`,
  unchangedMovedVariant: `${current}/action/primary`,
  metadataMovedVariant: `${current}/action/ghost`,
  nestedMovedVariant: `${current}/action/iconic`,
  removedActionVariant: `${previous}/action/secondary`,
  movedInvoice: `${current}/invoice`,
  keptInvoiceVariant: `${current}/invoice/overdue`,
  removedInvoiceVariant: `${previous}/invoice/paid`,
  movedPage: `${current}/guide`,
  moveIcon: "branch/moves/icon",
  moveRing: "branch/moves/ring",
} as const;

/** Every accepted pair, including the variants that follow their moved parent. */
export const movedFixturePairs = [
  [movedFixturePaths.pureMovedScreen, `${previous}/receipt`],
  [movedFixturePaths.movedAction, `${previous}/action`],
  [movedFixturePaths.unchangedMovedVariant, `${previous}/action/primary`],
  [movedFixturePaths.metadataMovedVariant, `${previous}/action/ghost`],
  [movedFixturePaths.nestedMovedVariant, `${previous}/action/iconic`],
  [movedFixturePaths.movedInvoice, `${previous}/invoice`],
  [movedFixturePaths.keptInvoiceVariant, `${previous}/invoice/overdue`],
  [movedFixturePaths.movedPage, `${previous}/guide`],
] as const;

/** Add the moved shapes without changing any source in the default catalogue. */
export const addMovedFixtureSources: ComparisonAdditions = async (
  root,
  side,
) => {
  const before = side === "Before";
  const prefix = before ? previous : current;
  if (before) {
    const config = JSON.parse(
      await fs.readFile(path.join(root, "mokly.config.json"), "utf8"),
    );
    config.stylesheets.unshift({
      match: "branch/moves/**/*.html",
      stylesheets: [],
    });
    await write(root, "mokly.config.json", JSON.stringify(config));
    await write(
      root,
      "specs/branch/moves/icon.component.html",
      source(
        {
          title: "Icon",
          element: "move-icon",
          propSchema: schema("name"),
          props: { name: "circle" },
        },
        "<i>{{name}}</i>",
      ),
    );
    await write(
      root,
      "specs/branch/moves/ring.component.html",
      source(
        {
          title: "Ring",
          element: "move-ring",
          propSchema: {
            type: "object",
            additionalProperties: false,
            properties: {},
          },
          slots: ["children"],
        },
        "<span><slot></slot></span>",
      ),
    );
  } else {
    for (const file of [
      "receipt.screen.html",
      "invoice.screen.html",
      "action.component.html",
      "guide.page.html",
    ])
      await fs.rm(path.join(root, "specs", previous, file));
  }
  const move = (name: string) =>
    before ? {} : { movedFrom: `${previous}/${name}` };
  await write(
    root,
    `specs/${prefix}/receipt.screen.html`,
    source(
      {
        title: "Receipt",
        ...move("receipt"),
      },
      "<h1>Receipt</h1>",
    ),
  );
  await write(
    root,
    `specs/${prefix}/invoice.screen.html`,
    source(
      {
        title: "Invoice",
        ...move("invoice"),
        propSchema: schema("due"),
        props: { due: before ? "Due in 14 days" : "Due on 14 March" },
        variants: [
          {
            slug: "overdue",
            title: "Overdue",
            props: { due: "Overdue invoice" },
          },
          ...(before
            ? [{ slug: "paid", title: "Paid", props: { due: "Paid invoice" } }]
            : []),
        ],
      },
      "<h1>Invoice</h1><p>{{due}}</p>",
    ),
  );
  await write(
    root,
    `specs/${prefix}/guide.page.html`,
    source(
      {
        title: "Payment guide",
        ...move("guide"),
      },
      "<!doctype html><html><head><title>Payment guide</title></head><body><h1>Payment guide</h1></body></html>",
    ),
  );
  await write(
    root,
    `specs/${prefix}/action.component.html`,
    source(
      {
        title: "Action",
        element: "move-action",
        ...move("action"),
        propSchema: schema("label"),
        props: { label: "Action" },
        slots: ["children"],
        variants: [
          { slug: "primary", title: "Primary", props: { label: "Continue" } },
          ...(before
            ? [
                {
                  slug: "secondary",
                  title: "Secondary",
                  props: { label: "Go back" },
                },
              ]
            : []),
          {
            slug: "ghost",
            title: "Ghost",
            description: before
              ? "A quiet action"
              : "A quiet action for skipping",
            props: { label: "Skip" },
          },
          {
            slug: "iconic",
            title: "Iconic",
            props: { label: "Next" },
            slots: {
              children: `<move-ring><move-icon mokly-instance="glyph" name="${before ? "arrow" : "chevron"}"></move-icon></move-ring>`,
            },
          },
        ],
      },
      "<button><slot></slot>{{label}}</button>",
    ),
  );
};
