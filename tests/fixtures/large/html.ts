import fs from "node:fs/promises";
import path from "node:path";

import { areaPaths } from "./dimensions.js";
import type { LargeSize } from "./dimensions.js";

const metadata = { relatedDocs: ["notes.md"] };
async function write(root: string, name: string, front: object, body?: string) {
  const file = path.join(root, "specs", name);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(
    file,
    body === undefined
      ? JSON.stringify(front)
      : `---\n${JSON.stringify(front)}\n---\n${body}`,
  );
}
export async function htmlArea(root: string, area: string, size: LargeSize) {
  const action = `${area}-action`;
  const panel = `${area}-panel`;
  await write(
    root,
    `${area}/components/action.component.html`,
    {
      ...metadata,
      title: "Action",
      description: "A reusable action.",
      element: action,
      propSchema: {
        type: "object",
        additionalProperties: false,
        required: ["label"],
        properties: {
          label: { type: "string" },
          disabled: { type: "boolean" },
          secondary: { type: "boolean" },
        },
      },
      props: { label: "Continue" },
      variants: [
        { slug: "default", title: "Default", props: { label: "Continue" } },
        {
          slug: "secondary",
          title: "Secondary",
          props: { label: "Save for later", secondary: true },
        },
        {
          slug: "disabled",
          title: "Disabled",
          props: { label: "Continue", disabled: true },
        },
      ],
    },
    '<button type="button" disabled="{{disabled}}" data-secondary="{{secondary}}">{{label}}</button>',
  );
  await write(
    root,
    `${area}/components/panel.component.html`,
    {
      ...metadata,
      title: "Panel",
      description: "A summary with caller-owned content.",
      element: panel,
      propSchema: {
        type: "object",
        additionalProperties: false,
        required: ["title"],
        properties: { title: { type: "string" } },
      },
      props: { title: "Overview" },
      slots: ["children"],
      variants: [
        {
          slug: "default",
          title: "Default",
          props: {},
          slots: { children: "<p>Review your recent activity.</p>" },
        },
        {
          slug: "empty",
          title: "Empty",
          props: {},
          slots: { children: "<p>No activity yet.</p>" },
        },
        {
          slug: "detailed",
          title: "Detailed",
          props: {},
          slots: {
            children:
              "<ul><li>Review progress</li><li>Choose your next step</li></ul>",
          },
        },
      ],
    },
    `<section class="scale-panel"><h2>{{title}}</h2><slot></slot><${action} label="View activity"></${action}></section>`,
  );
  const { screens, flows } = areaPaths(area, size.screens);
  for (const [i, group] of flows.entries())
    await write(root, `${area}/flows/flow-${i + 1}.use-case.yaml`, {
      ...metadata,
      title: `Activity journey ${i + 1}`,
      description: "Review connected activities.",
      steps: group.map((screenPath) => ({ screenPath })),
    });
  for (const [i, screen] of screens.entries()) {
    const rows = Array.from(
      { length: size.rows },
      (_, n) =>
        `<div role="row" class="scale-record"><span role="cell">Record ${n + 1}</span><span role="cell" mokly-viewport="desktop">Workspace ${(n % 4) + 1}</span><span role="cell">${n % 2 ? "Complete" : "In progress"}</span><span role="cell">${(n + 1) * 125}</span></div>`,
    ).join("");
    await write(
      root,
      `${screen}.screen.html`,
      {
        ...metadata,
        title: `Activity ${i + 1}`,
        description: "Review and manage workspace activity.",
        tags: ["activity", i % 2 ? "complete" : "in-progress"],
        useCasePaths: flows.flatMap((group, n) =>
          group.includes(screen) ? [`${area}/flows/flow-${n + 1}`] : [],
        ),
      },
      `<main class="scale-screen"><header><img src="../../../../../assets/mark.svg" width="28" height="28" alt=""><span>${area.replaceAll("-", " ")}</span><a href="mock:${area}/guide">Help</a></header><h1>Activity ${i + 1}</h1><input aria-label="Search activity" placeholder="Search activity"><${panel} title="Recent activity"><p>Review your records and choose your next step.</p><${action} label="New record"></${action}></${panel}><div role="table" aria-label="Activity" class="scale-records">${rows}</div><footer><${action} mokly-instance="footer" label="Save changes"></${action}><a href="mock:${screens[(i + 1) % size.screens]}#summary">Next activity</a><a href="mock:${area}/components/action">Available actions</a></footer><section id="summary"><h2>Summary</h2><p>${size.rows} records in this view.</p></section></main>`,
    );
  }
  await write(
    root,
    `${area}/guide.page.html`,
    {
      ...metadata,
      title: "Getting started",
      description: "A guide to workspace activity.",
    },
    `<!doctype html><html><head><title>Getting started</title><link rel="stylesheet" href="../../styles/assets/catalogue.css"></head><body><main><h1>Getting started</h1><p>Review activity and save your changes.</p><a href="mock:${screens[0]}#summary">Open activity</a></main></body></html>`,
  );
}
