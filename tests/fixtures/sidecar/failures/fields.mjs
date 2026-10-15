import {
  defineFolder,
  definePage,
  defineScreen,
  defineUseCase,
} from "@mokly/mokly";

export const page = definePage({
  title: "Fields",
  description: "Fields.",
  relatedDocs: [],
  render: () => "doc",
  extra: undefined,
});
export const folder = defineFolder({ path: "folder", extra: undefined });
export const screen = defineScreen({
  title: "Variants",
  description: "Variants.",
  relatedDocs: [],
  render: () => null,
  variants: [{ slug: "bad", title: "Bad", props: {}, variants: undefined }],
});
export const useCase = defineUseCase({
  title: "Steps",
  description: "Steps.",
  relatedDocs: [],
  steps: [{ screenPath: "x", extra: undefined }],
});
