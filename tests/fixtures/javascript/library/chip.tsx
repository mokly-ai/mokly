import { defineComponent, ReviewIgnoreScope } from "@mokly/mokly";

import styles from "./chip.module.css";

export const chip = defineComponent({
  element: "app-chip",
  title: "Chip",
  description: "A component with data and a slot.",
  relatedDocs: [],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label"],
    properties: { label: { type: "string", maxLength: 30 } },
  } as const,
  props: { label: "Saved" },
  slots: ["children"],
  controls: { label: { kind: "text", maxLength: 30 } },
  render: (props) => (
    <button className={styles.chip}>
      <style>{".runtime-chip { border: 0 }"}</style>
      {props.label}
      <ReviewIgnoreScope enabled={false}>{props.children}</ReviewIgnoreScope>
    </button>
  ),
  variants: [
    {
      slug: "emphasis",
      title: "Emphasis",
      props: { label: "Bold" },
      slots: { children: <b>Saved child</b> },
    },
  ],
});
