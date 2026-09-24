import { defineComponent, MockLink } from "@mokly/mokly";

import { Action } from "./action.js";

const dependency = "examples/basic/generated/example-components.css";
const implementation = "examples/basic/src/components/action/action.tsx";

export const action = defineComponent({
  id: "example-action",
  title: "Action",
  description: "A shared action with an optional destination and hint.",
  route: "components/action.html",
  dependencies: [dependency, implementation],
  ownedDependencies: [dependency, implementation],
  stylesheets: ["example-components.css"],
  relatedDocs: ["examples/basic/README.md"],
  tags: ["forms"],
  propSchema: {
    kind: "object",
    properties: {
      label: { schema: { kind: "string", minLength: 1 } },
      disabled: { schema: { kind: "boolean" }, optional: true },
      tone: { schema: { kind: "enum", values: ["primary", "secondary"] } },
      radius: {
        schema: { kind: "number", minimum: 0, maximum: 32 },
        optional: true,
      },
      destination: {
        schema: { kind: "enum", values: ["details", "welcome"] },
        optional: true,
      },
      hint: { schema: { kind: "string" }, optional: true },
    },
  },
  controls: {
    label: { kind: "text", label: "Label", maxLength: 80 },
    disabled: { kind: "boolean", label: "Disabled" },
    radius: {
      kind: "number",
      label: "Corner radius",
      minimum: 0,
      maximum: 32,
      step: 1,
    },
    tone: {
      kind: "select",
      label: "Emphasis",
      options: [
        { label: "Primary", value: "primary" },
        { label: "Secondary", value: "secondary" },
      ],
    },
    hint: { kind: "text", label: "Hint", maxLength: 120 },
  },
  render(props) {
    const destination = props.destination;
    return (
      <Action
        disabled={props.disabled ?? false}
        label={props.label}
        tone={props.tone}
        {...(props.radius === undefined ? {} : { radius: props.radius })}
        {...(props.hint === undefined ? {} : { hint: props.hint })}
        {...(destination === undefined
          ? {}
          : {
              wrap: (button) => (
                <MockLink
                  asChild
                  to={
                    destination === "details"
                      ? "example-details"
                      : "example-welcome"
                  }
                  {...(destination === "details"
                    ? { fragment: "details" }
                    : {})}
                >
                  {button}
                </MockLink>
              ),
            })}
      />
    );
  },
  variants: [
    {
      id: "default",
      title: "Default",
      props: {
        label: "Continue",
        tone: "primary",
        radius: 8,
        disabled: false,
        hint: "Continue when you’re ready.",
      },
    },
    {
      id: "disabled",
      title: "Disabled",
      props: { label: "Continue", tone: "primary", radius: 8, disabled: true },
    },
    {
      id: "secondary",
      title: "Secondary",
      props: {
        label: "Go back",
        tone: "secondary",
        radius: 8,
        disabled: false,
      },
    },
  ],
});
