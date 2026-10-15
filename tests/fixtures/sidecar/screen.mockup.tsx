import {
  defineScreen,
  MockLink,
  ReviewIgnore,
  ReviewIgnoreScope,
} from "@mokly/mokly";

import { control } from "./component.mockup.js";

export const screen = defineScreen({
  path: "screens/home",
  title: "Home",
  description: "A screen.",
  relatedDocs: [],
  props: { label: "Save" },
  render: (props, context) => (
    <main data-scheme={context.colorScheme}>
      <control.Component label={props.label} moklyInstance="primary">
        <ReviewIgnoreScope enabled={true}>
          <ReviewIgnore id="inside">
            <i>Child</i>
          </ReviewIgnore>
        </ReviewIgnoreScope>
      </control.Component>
      <MockLink asChild to="./destination">
        <button>Go</button>
      </MockLink>
    </main>
  ),
  variants: [{ slug: "empty", title: "Empty", props: { label: "Empty" } }],
});
