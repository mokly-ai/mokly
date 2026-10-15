import { definePage, defineUseCase } from "@mokly/mokly";
const hidden = definePage({
  title: "Hidden",
  description: "",
  relatedDocs: [],
  render: () => "",
});
export const source = defineUseCase({
  title: "Source",
  description: "",
  relatedDocs: [],
  steps: [{ screenPath: hidden }],
});
