import {
  defineComponent,
  definePage,
  defineRoot,
  defineScreen,
  defineUseCase,
  folder,
  page,
  screen,
} from "@mokly/mokly";

const node = <main>Type check</main>;
const screenInputBase = {
  id: "typed-screen",
  title: "Typed screen",
  description: "Screen",
  relatedDocs: [],
  mobile: node,
  desktop: node,
};
const typedVariant = {
  id: "typed-variant",
  title: "Variant",
  description: "Variant",
  mobile: node,
  desktop: node,
};
const documentPage = {
  id: "typed-page",
  title: "Page",
  description: "Page",
  relatedDocs: [],
  render: () => "<html/>",
};

// @ts-expect-error A direct screen cannot declare removed dependencies.
defineScreen({ ...screenInputBase, dependencies: [] });
defineScreen({
  ...screenInputBase,
  // @ts-expect-error Variants do not restore the removed parent field.
  dependencies: [],
  variants: [typedVariant],
});
defineScreen({
  ...screenInputBase,
  variants: [
    {
      ...typedVariant,
      // @ts-expect-error A screen variant cannot declare removed dependencies.
      dependencies: [],
    },
  ],
});
// @ts-expect-error Pages cannot declare removed dependencies.
definePage({ ...documentPage, dependencies: [] });
defineUseCase({
  description: "Flow",
  id: "flow",
  relatedDocs: [],
  steps: [],
  title: "Flow",
  // @ts-expect-error Use cases cannot declare removed dependencies.
  dependencies: [],
});
screen({
  description: "Nested",
  desktop: node,
  id: "nested",
  mobile: node,
  title: "Nested",
  // @ts-expect-error Nested screens cannot declare removed dependencies.
  dependencies: [],
});
page({
  description: "Nested",
  id: "nested-page",
  render: documentPage.render,
  title: "Nested",
  // @ts-expect-error Nested pages cannot declare removed dependencies.
  dependencies: [],
});
folder({
  title: "Nested group",
  children: [],
  // @ts-expect-error Folder metadata cannot declare removed dependencies.
  dependencies: [],
});
defineRoot({
  navPath: ["Nested"],
  children: [],
  // @ts-expect-error Root path metadata cannot declare removed dependencies.
  dependencies: [],
});
const componentInput = {
  id: "typed-component",
  title: "Typed component",
  description: "Component",
  relatedDocs: [],
  propSchema: { kind: "object" as const, properties: {} },
  render: () => null,
  variants: [{ id: "default", title: "Default", props: {} }],
};
// @ts-expect-error Components cannot declare removed dependencies.
defineComponent({ ...componentInput, dependencies: [] });
// @ts-expect-error Components cannot declare removed ownership paths.
defineComponent({ ...componentInput, ownedDependencies: [] });

defineComponent({
  ...componentInput,
  variants: [
    {
      id: "typed-component-default",
      title: "Default",
      props: {},
      // @ts-expect-error Flattened component variants cannot declare removed dependencies.
      dependencies: [],
    },
  ],
});
defineComponent({
  ...componentInput,
  variants: [
    {
      id: "typed-component-default",
      title: "Default",
      props: {},
      // @ts-expect-error Flattened component variants cannot declare removed ownership paths.
      ownedDependencies: [],
    },
  ],
});
