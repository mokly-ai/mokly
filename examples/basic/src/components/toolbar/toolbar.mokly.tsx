import { defineComponent } from "@mokly/mokly";

import { action } from "../action/action.mokly.js";

import { Toolbar } from "./toolbar.js";

const dependency = "examples/basic/generated/example-components.css";
const implementation = "examples/basic/src/components/toolbar/toolbar.tsx";

export const toolbar = defineComponent({
  id: "example-toolbar",
  title: "Toolbar",
  description: "A composed toolbar with caller-supplied content.",
  route: "components/toolbar.html",
  dependencies: [dependency, implementation],
  ownedDependencies: [dependency, implementation],
  relatedDocs: ["examples/basic/README.md"],
  propSchema: {
    kind: "object",
    properties: { title: { schema: { kind: "string", minLength: 1 } } },
  },
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
      id: "default",
      title: "Default",
      props: {
        title: "Workspace actions",
        children: <p>Choose where to continue.</p>,
      },
    },
  ],
});
