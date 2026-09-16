/** An opt-in consumer fixture used by build, comparison, and serving tests. */
export function componentEntrySource(
  options: {
    body?: string;
    actionRender?: string;
    extra?: string;
    exports?: string;
    paneRender?: string;
    paneVariants?: string;
  } = {},
): string {
  return `import React from "react";
import { defineComponent, defineCollection, defineScreen, MockLink, ReviewIgnore } from "@mokly/mokly";
const metadata = { dependencies: ["notes.md"], relatedDocs: [] };
const action = defineComponent({ ...metadata,
  id: "action", title: "Action", description: "A shared action", route: "components/action.html",
  propSchema: { kind: "object", properties: { label: { schema: { kind: "string" } }, disabled: { schema: { kind: "boolean" }, optional: true }, hidden: { schema: { kind: "boolean" }, optional: true } } },
  controls: { label: { kind: "text", maxLength: 80 }, disabled: { kind: "boolean" } },
  render: ${options.actionRender ?? "(props, context) => props.hidden ? null : <button data-viewport={context.viewport} disabled={props.disabled}>{props.label}</button>"},
  variants: [{ id: "default", title: "Default", props: { label: "Continue" } }, { id: "disabled", title: "Disabled", props: { label: "Continue", disabled: true } }]
});
const pane = defineComponent({ ...metadata,
  id: "pane", title: "Pane", description: "A caller-owned content slot", route: "components/pane.html",
  propSchema: { kind: "object", properties: {} }, slots: ["children"],
  render: ${options.paneRender ?? '(props) => <section>{props.children}<action.Component label="Inside" /></section>'},
  variants: ${options.paneVariants ?? '[{ id: "default", title: "Default", props: { children: <strong>Saved content</strong> } }]'}
});
${options.extra ?? ""}
export const mockups = [
  defineCollection({ ...metadata, id: "components", title: "Components", description: "Shared components", childIds: ["action", "pane"] }),
  ${options.exports ?? "action.entry, pane.entry,"}
  defineScreen({ ...metadata, id: "home", title: "Home", description: "A consuming screen", route: "screens/home.html", mobile: <main>${options.body ?? '<pane.Component><p>Screen content</p><action.Component label="Slot action" /></pane.Component><action.Component moklyInstance="footer" label="Finish" /><action.Component moklyInstance="hidden" label="Hidden" hidden /><MockLink to="action">Open Action</MockLink>'}</main>, desktop: <main>${options.body ?? '<pane.Component><p>Screen content</p><action.Component label="Slot action" /></pane.Component><action.Component moklyInstance="footer" label="Finish" /><action.Component moklyInstance="hidden" label="Hidden" hidden /><MockLink to="action">Open Action</MockLink>'}</main> })
];`;
}
