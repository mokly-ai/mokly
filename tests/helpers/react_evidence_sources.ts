import fs from "node:fs/promises";
import path from "node:path";

import type { ComparisonAdditions } from "./comparison_catalogue.js";
import { repositoryRoot } from "./fixture.js";
import { write } from "./static_changes.js";

/** The React entries that the small copy adds to the default catalogue. */
export const reactEvidencePaths = {
  button: "react/button",
  buttonVariant: "react/button/default",
  pane: "react/pane",
  checkout: "react/checkout",
  home: "react/home",
  badge: "react/badge",
  badgeVariant: "react/badge/default",
} as const;

/** The stylesheets as the shell names them. */
export const reactEvidenceStylesheets = {
  bundle: "static/mokly-generated/styles/specs/react/index.mockup.tsx.css",
  wrapper: "static/mokly-generated/styles/wrapper.css",
} as const;

/** One colour per side, so every changed rule differs between the commits. */
const tone = (side: "Before" | "After") =>
  side === "Before" ? "rgb(180, 30, 30)" : "rgb(30, 60, 180)";

/**
 * Button, Pane and two screens in one module that imports `rule.css`. Pane
 * nests a Button; Home holds nested, repeated and hidden Button instances;
 * Checkout's own heading sits beside a Button.
 */
const entries = `import React from "react";
import { defineComponent, defineScreen } from "@mokly/mokly";
import "./rule.css";
const metadata = { description: "A React evidence fixture", relatedDocs: [] };
export const button = defineComponent({ ...metadata, path: "react/button", title: "Button",
  propSchema: { type: "object", additionalProperties: false, required: ["label"],
    properties: { label: { type: "string" }, hidden: { type: "boolean" } } },
  props: { label: "Continue" },
  render: (props) => (props.hidden ? null : <button className="button">{props.label}</button>),
  variants: [{ slug: "default", title: "Default", props: { label: "Continue" } }] });
export const pane = defineComponent({ ...metadata, path: "react/pane", title: "Pane",
  propSchema: { type: "object", additionalProperties: false, properties: {} }, props: {}, slots: ["children"],
  render: (props) => <section>{props.children}<button.Component label="Inside" /></section> });
export const checkout = defineScreen({ ...metadata, path: "react/checkout", title: "Checkout", props: {},
  render: () => <main><h1 className="heading">Checkout</h1><button.Component label="Pay" /></main> });
export const home = defineScreen({ ...metadata, path: "react/home", title: "Home", props: {},
  render: () => <main><pane.Component><p>Screen content</p><button.Component label="Slot action" /></pane.Component><button.Component moklyInstance="footer" label="Finish" /><button.Component moklyInstance="hidden" label="Hidden" hidden /></main> });
`;

/** Badge lives in its own module, so the bundled sheet never reaches it. */
const badge = `import React from "react";
import { defineComponent } from "@mokly/mokly";
export const badge = defineComponent({ description: "A wrapped component", relatedDocs: [],
  path: "react/badge", title: "Badge",
  propSchema: { type: "object", additionalProperties: false, properties: { label: { type: "string" } } },
  props: { label: "New" },
  render: (props) => <span className="badge">{props.label}</span>,
  variants: [{ slug: "default", title: "Default", props: { label: "Sale" } }] });
`;

/** Every React render sits in a wrapper outside the component's own output. */
const renderer = `import React from "react";
export default function render({ node }) {
  return <div className="frame">{node}</div>;
}
`;

/**
 * A React group on the default catalogue. The module's imported sheet changes
 * a Button rule and Checkout's heading rule; a configured sheet that only
 * Badge's documents link changes the renderer wrapper's rule. Other React
 * documents link only an unchanged sheet. The repository's dependencies are
 * linked in and ignored by Git.
 */
export const addReactEvidenceSources: ComparisonAdditions = async (
  root,
  side,
) => {
  await write(
    root,
    "specs/react/rule.css",
    `.button { color: ${tone(side)}; }\n.heading { color: ${tone(side)}; }\n`,
  );
  await write(root, "wrapper.css", `.frame { color: ${tone(side)}; }\n`);
  if (side === "After") return;
  const file = path.join(root, "mokly.config.json");
  const config = JSON.parse(await fs.readFile(file, "utf8"));
  config.renderer = "renderer.tsx";
  config.stylesheets.unshift(
    { match: "react/badge/**", stylesheets: ["wrapper.css"] },
    { match: "react/**", stylesheets: ["plain.css"] },
  );
  await fs.writeFile(file, JSON.stringify(config));
  await fs.appendFile(path.join(root, ".gitignore"), "node_modules\n");
  await fs.symlink(
    path.join(repositoryRoot, "node_modules"),
    path.join(root, "node_modules"),
    "junction",
  );
  await write(root, "renderer.tsx", renderer);
  await write(root, "specs/react/index.mockup.tsx", entries);
  await write(root, "specs/react/badge.mockup.tsx", badge);
};
