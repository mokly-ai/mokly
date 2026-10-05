import {
  defineComponent,
  definePage,
  defineFolder,
  defineScreen,
  defineUseCase,
} from "@mokly/mokly";

const node = <main>Type check</main>;
const screenInputBase = {
  path: "typed-screen",
  title: "Typed screen",
  description: "Screen",
  relatedDocs: [],
  mobile: node,
  desktop: node,
};
const typedVariant = {
  slug: "typed-variant",
  title: "Variant",
  description: "Variant",
  mobile: node,
  desktop: node,
};
const documentPage = {
  path: "typed-page",
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
  path: "flow",
  relatedDocs: [],
  steps: [],
  title: "Flow",
  // @ts-expect-error Use cases cannot declare removed dependencies.
  dependencies: [],
});
defineFolder({
  path: "nested",
  title: "Nested group",
  // @ts-expect-error Folder metadata cannot declare removed dependencies.
  dependencies: [],
});
const componentInput = {
  path: "typed-component",
  title: "Typed component",
  description: "Component",
  relatedDocs: [],
  propSchema: { kind: "object" as const, properties: {} },
  render: () => null,
  variants: [{ slug: "default", title: "Default", props: {} }],
};
// @ts-expect-error Components cannot declare removed dependencies.
defineComponent({ ...componentInput, dependencies: [] });
// @ts-expect-error Components cannot declare removed ownership paths.
defineComponent({ ...componentInput, ownedDependencies: [] });

defineComponent({
  ...componentInput,
  variants: [
    {
      slug: "default",
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
      slug: "default",
      title: "Default",
      props: {},
      // @ts-expect-error Flattened component variants cannot declare removed ownership paths.
      ownedDependencies: [],
    },
  ],
});
