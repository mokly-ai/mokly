import { defineScreen, MockLink } from "@mokly/mokly";

import { component } from "../c.mockup.js";
import { greeting } from "../h.js";
import { target } from "../t/t.mockup.js";

export const screen = defineScreen({
  title: "S",
  description: "Screen S.",
  relatedDocs: [],
  props: {},
  render: () => (
    <main>
      {greeting}
      <component.Component />
      <MockLink to={target}>T</MockLink>
    </main>
  ),
});
