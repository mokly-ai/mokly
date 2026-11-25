import { defineScreen } from "@mokly/mokly";

import { events } from "./state.js";

export const screen = defineScreen({
  title: "Setup State",
  description: "Shows the events from the story hooks.",
  relatedDocs: [],
  props: {},
  render: () => <output>{events.join(",")}</output>,
});
