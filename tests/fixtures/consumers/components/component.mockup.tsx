import React, { type ReactNode } from "react";

import { defineComponent, defineScreen } from "@mokly/mokly";

const metadata = { relatedDocs: [] };
function Body({ children }: { children: ReactNode }) {
  return <section data-component-preview>{children}</section>;
}
const action = defineComponent({
  ...metadata,
  id: "packed-action",
  title: "Packed action",
  description: "A registered consumer component.",
  propSchema: {
    kind: "object",
    properties: {
      label: { schema: { kind: "string" } },
      disabled: { schema: { kind: "boolean" }, optional: true },
    },
  },
  controls: { label: { kind: "text" }, disabled: { kind: "boolean" } },
  render: (props, context) => (
    <Body>
      <button data-viewport={context.viewport} disabled={props.disabled}>
        {props.label}
      </button>
    </Body>
  ),
  variants: [
    {
      id: "packed-action-default",
      title: "Default",
      props: { label: "Continue" },
    },
    {
      id: "packed-action-disabled",
      title: "Disabled",
      props: { label: "Continue", disabled: true },
    },
  ],
});
const panel = defineComponent({
  ...metadata,
  id: "packed-panel",
  title: "Packed panel",
  description: "Nested components and a caller-owned slot.",
  propSchema: { kind: "object", properties: {} },
  slots: ["children"],
  render: (props) => (
    <div>
      {props.children}
      <action.Component label="Inside" />
    </div>
  ),
  variants: [
    {
      id: "packed-panel-default",
      title: "Default",
      props: { children: <p>Saved slot</p> },
    },
  ],
});
export const mockups = [
  action.entries,
  panel.entries,
  defineScreen({
    ...metadata,
    id: "packed-components",
    title: "Component consumer",
    description: "Repeated and nested component use.",
    mobile: (
      <main>
        <panel.Component>
          <action.Component label="Caller slot" />
        </panel.Component>
        <action.Component label="Footer" />
      </main>
    ),
    desktop: (
      <main>
        <panel.Component>
          <action.Component label="Caller slot" />
        </panel.Component>
        <action.Component label="Footer" />
      </main>
    ),
  }),
];
