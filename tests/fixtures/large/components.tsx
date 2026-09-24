import { Button } from "@firna/ui/button";

import { defineComponent } from "@mokly/mokly";

const metadata = {
  relatedDocs: ["notes.md"],
};
const noop = () => {};

export function createComponents(area: string) {
  const action = defineComponent({
    ...metadata,
    id: `${area}-action`,
    title: "Action",
    description: "A reusable action.",
    route: `${area}/components/action.html`,
    propSchema: {
      kind: "object",
      properties: {
        label: { schema: { kind: "string" } },
        disabled: { schema: { kind: "boolean" }, optional: true },
        secondary: { schema: { kind: "boolean" }, optional: true },
      },
    },
    controls: {
      label: { kind: "text" },
      disabled: { kind: "boolean" },
      secondary: { kind: "boolean" },
    },
    render: (props) => (
      <Button
        onPress={noop}
        disabled={props.disabled ?? false}
        tone={props.secondary ? "secondary" : "primary"}
      >
        {props.label}
      </Button>
    ),
    variants: [
      { id: "default", title: "Default", props: { label: "Continue" } },
      {
        id: "secondary",
        title: "Secondary",
        props: { label: "Save for later", secondary: true },
      },
      {
        id: "disabled",
        title: "Disabled",
        props: { label: "Continue", disabled: true },
      },
    ],
  });
  const panel = defineComponent({
    ...metadata,
    id: `${area}-panel`,
    title: "Panel",
    description: "A summary with caller-owned content.",
    route: `${area}/components/panel.html`,
    propSchema: {
      kind: "object",
      properties: { title: { schema: { kind: "string" } } },
    },
    slots: ["children"],
    controls: { title: { kind: "text" } },
    render: (props) => (
      <section className="scale-panel">
        <h2>{props.title}</h2>
        {props.children}
        <action.Component label="View activity" />
      </section>
    ),
    variants: [
      {
        id: "default",
        title: "Default",
        props: {
          title: "Overview",
          children: <p>Review your recent activity.</p>,
        },
      },
      {
        id: "empty",
        title: "Empty",
        props: { title: "Overview", children: <p>No activity yet.</p> },
      },
      {
        id: "detailed",
        title: "Detailed",
        props: {
          title: "Overview",
          children: (
            <ul>
              <li>Review progress</li>
              <li>Choose your next step</li>
            </ul>
          ),
        },
      },
    ],
  });
  return { action, panel };
}

export type AreaComponents = ReturnType<typeof createComponents>;
