import { defineComponent, ReviewIgnore, ReviewIgnoreScope } from "@mokly/mokly";

import styles from "./control.module.css";

export const control = defineComponent({
  path: "components/control",
  element: "test-control",
  title: "Control",
  description: "A component with a data prop and a slot.",
  relatedDocs: [],
  propSchema: {
    type: "object",
    additionalProperties: false,
    properties: { label: { type: "string" } },
    required: ["label"],
  } as const,
  props: { label: "Saved" },
  slots: ["children"],
  render: (props, context) => (
    <section className={styles.control} data-viewport={context.viewport}>
      <style>{".inline-control{color:red}"}</style>
      <button>{props.label}</button>
      <ReviewIgnore id="chrome">
        <span>Chrome</span>
      </ReviewIgnore>
      <ReviewIgnoreScope enabled={false}>{props.children}</ReviewIgnoreScope>
    </section>
  ),
  variants: [
    {
      slug: "disabled",
      title: "Disabled",
      props: { label: "Stop" },
      slots: { children: <b>Saved child</b> },
    },
  ],
});
