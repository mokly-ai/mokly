import { Button } from "@firna/ui/button";

import { defineComponent } from "@mokly/mokly";

const metadata = {
  relatedDocs: ["notes.md"],
};
const noop = () => {};

export function createComponents(area: string) {
  const action = defineComponent({
    ...metadata,

    path: `${area}/components/action`,
    title: "Action",
    description: "A reusable action.",
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
  });
  const panel = defineComponent({
    ...metadata,

    path: `${area}/components/panel`,
    title: "Panel",
    description: "A summary with caller-owned content.",
    propSchema: {
      type: "object",
      additionalProperties: false,
      required: ["title"],
      properties: { title: { type: "string" } },
    },
    props: { title: "Overview" },
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
        slug: "default",
        title: "Default",
        props: { title: "Overview" },
        slots: { children: <p>Review your recent activity.</p> },
      },
      {
        slug: "empty",
        title: "Empty",
        props: { title: "Overview" },
        slots: { children: <p>No activity yet.</p> },
      },
      {
        slug: "detailed",
        title: "Detailed",
        props: { title: "Overview" },
        slots: {
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
