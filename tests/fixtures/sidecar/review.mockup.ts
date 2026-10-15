import { defineScreen } from "@mokly/mokly";

const label = <string>"plain";
export const rows = [{ label }];
export const screen = defineScreen({
  title: "Review",
  description: "",
  relatedDocs: [],
  props: { label, callback: () => 1 },
  // eslint-disable-next-line no-prototype-builtins -- Exercise ordinary consumer props.
  render: (props) => (props.hasOwnProperty("label") ? props.label : "missing"),
});
