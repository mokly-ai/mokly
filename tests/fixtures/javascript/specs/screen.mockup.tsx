import { defineScreen, MockLink, ReviewIgnore } from "@mokly/mokly";

import { chip } from "./components/chip.mockup.js";

export default defineScreen({
  title: "React screen",
  description: "A screen with a registered component.",
  relatedDocs: [],
  props: { label: "Hello" },
  render: (props, context) => (
    <main data-viewport={context.viewport}>
      <h1>{props.label}</h1>
      <chip.Component label={props.label} moklyInstance="first">
        <em>Supplied child</em>
      </chip.Component>
      <ReviewIgnore id="clock">
        <time>Stable fixture</time>
      </ReviewIgnore>
      <MockLink asChild to="mixed">
        <button>Mixed page</button>
      </MockLink>
    </main>
  ),
  variants: [
    { slug: "other", title: "Other title", props: { label: "Other" } },
  ],
});
