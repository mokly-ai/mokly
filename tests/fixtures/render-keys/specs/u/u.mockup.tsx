import { defineScreen } from "@mokly/mokly";

import "./u.css";

export const unrelated = defineScreen({
  title: "U",
  description: "Unrelated screen U.",
  relatedDocs: [],
  props: {},
  render: () => <main className="u">U</main>,
});
