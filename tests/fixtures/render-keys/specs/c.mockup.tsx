import { dep } from "dep";

import { defineComponent } from "@mokly/mokly";

import styles from "./c.module.css";
import { provider } from "./p.mockup.js";

export const component = defineComponent({
  element: "app-c",
  title: "C",
  description: "Component C.",
  relatedDocs: [],
  propSchema: {
    type: "object",
    additionalProperties: false,
    properties: {},
  } as const,
  props: {},
  slots: ["children"],
  render: (props) => (
    <b className={styles.card}>
      {dep}
      {props.children}
    </b>
  ),
  variants: [
    {
      slug: "filled",
      title: "Filled",
      props: {},
      slots: { children: <provider.Component /> },
    },
  ],
});
