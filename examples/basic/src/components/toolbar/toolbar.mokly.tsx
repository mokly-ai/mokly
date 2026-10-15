import { defineComponent } from "@mokly/mokly";

import { action } from "../action/action.mokly.js";

import { Toolbar } from "./toolbar.js";

export const toolbar = defineComponent({
  slug: "index",
  title: "Toolbar",
  description: "A composed toolbar with caller-supplied content.",
  stylesheets: ["example-components.css"],
  relatedDocs: ["examples/basic/README.md"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["title"],
    properties: { title: { type: "string", minLength: 1 } },
  } as const,
  props: { title: "Workspace actions" },
  controls: { title: { kind: "text", label: "Title", maxLength: 80 } },
  slots: ["children"],
  render: (props) => (
    <Toolbar
      title={props.title}
      actions={
        <>
          <action.Component
            moklyInstance="primary"
            label="Browse details"
            tone="primary"
            destination="details"
          />
          <action.Component
            moklyInstance="secondary"
            label="Browse welcome"
            tone="secondary"
            destination="welcome"
          />
        </>
      }
    >
      {props.children}
    </Toolbar>
  ),
  variants: [
    {
      slug: "default",
      title: "Default",
      props: { title: "Workspace actions" },
      slots: { children: <p>Choose where to continue.</p> },
    },
  ],
});
