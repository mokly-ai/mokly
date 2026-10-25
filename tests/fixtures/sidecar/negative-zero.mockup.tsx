import { defineScreen } from "@mokly/mokly";

export default defineScreen({
  title: "Negative zero",
  description: "Lossless numbers.",
  relatedDocs: [],
  props: { value: -0 },
  render: (props) => (
    <main>{Object.is(props.value, -0) ? "negative" : "positive"}</main>
  ),
});
