import { defineScreen } from "@mokly/mokly";

import { trace } from "./state.js";

export const screen = defineScreen({
  title: "Setup State",
  description: "Shows the state of the story hooks.",
  relatedDocs: [],
  props: {},
  render: () => <output>{trace()}</output>,
});
