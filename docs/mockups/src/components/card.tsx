import { Body, Caption, H3 } from "@firna/ui/typography";

import { componentInput, componentMetadata } from "./metadata";

export const cardInput = componentInput({
  ...componentMetadata(
    "Card",
    "A grouped decision, content block, or selectable item.",
  ),
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["title"],
    properties: {
      title: { type: "string" },
      selected: { type: "boolean" },
    },
  },
  props: { title: "Keep the conversation together" },
  slots: ["children", "footer"],
  controls: { title: { kind: "text" }, selected: { kind: "boolean" } },
  render: ({ title, selected, children, footer }) => (
    <section className={"card" + (selected ? " card-selected" : "")}>
      <H3>{title}</H3>
      {selected && <Caption color="primary">Selected</Caption>}
      {children}
      {footer && <div className="card-footer">{footer}</div>}
    </section>
  ),
  variants: [
    {
      slug: "plain",
      title: "Plain",
      props: { title: "Keep the conversation together" },
      slots: {
        children: (
          <Body>Review the screen and leave a comment where it matters.</Body>
        ),
      },
    },
    {
      slug: "selected",
      title: "Selected",
      props: { title: "Email updates", selected: true },
      slots: { children: <Body>Receive replies to your comments.</Body> },
    },
  ],
});
