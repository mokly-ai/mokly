import { Global, css } from "@emotion/react";
import { createGlobalStyle } from "styled-components";

import { defineComponent, defineScreen } from "@mokly/mokly";

const StackStyles = createGlobalStyle`
  .stack > * + * { margin-top: 8px; }
`;
const StackEmotionStyles = css`
  .stack-emotion > * + * { margin-top: 9px; }
`;
const LayoutStyles = createGlobalStyle`
  .layout { border: 1px solid red; }
`;

export const card = defineComponent({
  title: "Card",
  description: "",
  relatedDocs: [],
  element: "ui-card",
  propSchema: { type: "object", additionalProperties: false },
  props: {},
  render: () => <article className="card">Card</article>,
});

export const stack = defineComponent({
  title: "Stack",
  description: "",
  relatedDocs: [],
  element: "ui-stack",
  propSchema: { type: "object", additionalProperties: false },
  props: {},
  slots: ["children"],
  render: (props) => (
    <>
      <StackStyles />
      <Global styles={StackEmotionStyles} />
      <div className="stack stack-emotion">{props.children}</div>
    </>
  ),
});

export const layout = defineComponent({
  title: "Layout",
  description: "",
  relatedDocs: [],
  element: "ui-layout",
  propSchema: { type: "object", additionalProperties: false },
  props: {},
  render: () => (
    <>
      <LayoutStyles />
      <div className="layout">
        <stack.Component>
          <card.Component />
          <card.Component moklyInstance="second" />
        </stack.Component>
      </div>
    </>
  ),
});

export default defineScreen({
  title: "Registry ownership",
  description: "",
  relatedDocs: [],
  render: () => <layout.Component />,
});
