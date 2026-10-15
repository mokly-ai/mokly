import { definePage, defineScreen, MockLink } from "@mokly/mokly";
const hidden = definePage({
  title: "Hidden",
  description: "",
  relatedDocs: [],
  render: () => "",
});
export const source = defineScreen({
  title: "Source",
  description: "",
  relatedDocs: [],
  render: () => <MockLink to={hidden}>Link</MockLink>,
});
