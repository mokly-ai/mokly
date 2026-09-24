import type { ReactNode } from "react";

import {
  collection,
  defineCollection,
  defineConfig,
  defineRoot,
  definePage,
  page,
  defineScreen,
  defineUseCase,
  MockLink,
  mockLink,
  ReviewIgnore,
  ReviewIgnoreScope,
  reviewMaterialKey,
  screen,
  type CollectionDefinition,
  type CollectionInput,
  type CompatibilityConfig,
  type CompatibilityTransformer,
  type CompatibilityTransformInput,
  type EntryInput,
  type PageInput,
  type PageDefinition,
  type NestedPageInput,
  type ModuleLoader,
  type ModuleResolutionConfig,
  type MoklyConfig,
  type RegistryDefinition,
  type Renderer,
  type RenderInput,
  type ReviewConfig,
  type RootInput,
  type RoutedEntryInput,
  type ScreenDefinition,
  type ScreenInput,
  type ScreenVariantInput,
  type StylesheetRule,
  type UseCaseDefinition,
  type UseCaseInput,
  type UseCaseStep,
  type Viewport,
  type WatchAction,
  type WatchConfig,
  type WatchRule,
} from "@mokly/mokly";

const config: MoklyConfig = defineConfig({
  entriesDir: "entries",
  mockupsDir: "mockups",
});
const node: ReactNode = (
  <MockLink fragment="typed-section" to="typed-screen">
    Typed link
  </MockLink>
);
const typedLink: string = mockLink("typed-screen", "typed-section");
const childLink = (
  <MockLink asChild to="typed-screen">
    <button>Continue</button>
  </MockLink>
);
const invalidChildLink = (
  // @ts-expect-error Child mode requires one React element.
  <MockLink asChild to="typed-screen">
    Text
  </MockLink>
);
const invalidChildProps = (
  // @ts-expect-error Styling belongs on the child in child mode.
  <MockLink asChild to="typed-screen" className="button">
    <button>Continue</button>
  </MockLink>
);
const documentPage: PageInput = {
  id: "typed-page",
  title: "Page",
  description: "Page",
  relatedDocs: [],
  route: "page.html",
  render: () => "<html><body>Page</body></html>",
};
const nestedPage: NestedPageInput = {
  id: "nested-page",
  title: "Page",
  description: "Page",
  slug: "page",
  render: documentPage.render,
};
const typedVariant: ScreenVariantInput = {
  description: "Typed empty state",
  desktop: <main>Empty</main>,
  id: "typed-screen-empty",
  mobile: <main>Empty</main>,
  slug: "empty",
  title: "Typed screen, empty",
};
const screenInputBase = {
  description: "Typed return boundary",
  desktop: node,
  id: "typed-return-boundary",
  mobile: node,
  relatedDocs: [],
  route: "typed/return-boundary.html",
  title: "Typed return boundary",
} as const;
const singleDefinition: ScreenDefinition = defineScreen(screenInputBase);
const undefinedDefinition: ScreenDefinition = defineScreen({
  ...screenInputBase,
  variants: undefined,
});
const emptyDefinitions: readonly ScreenDefinition[] = defineScreen({
  ...screenInputBase,
  variants: [],
});
const populatedDefinitions: readonly ScreenDefinition[] = defineScreen({
  ...screenInputBase,
  variants: [typedVariant],
});
declare const broadScreenInput: ScreenInput;
const broadDefinitions: ScreenDefinition | readonly ScreenDefinition[] =
  defineScreen(broadScreenInput);
// @ts-expect-error An optional variants input can return an array.
const unsafeBroadDefinition: ScreenDefinition = defineScreen(broadScreenInput);
// @ts-expect-error An optional variants input can return one definition.
const unsafeBroadArray: readonly ScreenDefinition[] =
  defineScreen(broadScreenInput);
function defineThroughGeneric<const T extends ScreenInput>(input: T) {
  return defineScreen(input);
}
const genericSingle: ScreenDefinition = defineThroughGeneric(screenInputBase);
const genericUndefined: ScreenDefinition = defineThroughGeneric({
  ...screenInputBase,
  variants: undefined,
});
const genericEmpty: readonly ScreenDefinition[] = defineThroughGeneric({
  ...screenInputBase,
  variants: [],
});
// @ts-expect-error A generic wrapper retains a broad input's uncertain shape.
const unsafeGeneric: ScreenDefinition = defineThroughGeneric(broadScreenInput);
declare const maybeVariants: readonly ScreenVariantInput[] | undefined;
const maybeDefinitions: ScreenDefinition | readonly ScreenDefinition[] =
  defineScreen({ ...screenInputBase, variants: maybeVariants });
// @ts-expect-error A required array-or-undefined value retains both outcomes.
const unsafeMaybe: ScreenDefinition = defineScreen({
  ...screenInputBase,
  variants: maybeVariants,
});
declare const absentVariants: typeof screenInputBase & { variants?: never };
const absentDefinition: ScreenDefinition = defineScreen(absentVariants);
declare const optionalVariants: typeof screenInputBase & {
  variants?: readonly ScreenVariantInput[];
};
const optionalDefinitions: ScreenDefinition | readonly ScreenDefinition[] =
  defineScreen(optionalVariants);
const optionalGenericDefinitions:
  ScreenDefinition | readonly ScreenDefinition[] =
  defineThroughGeneric(optionalVariants);
// @ts-expect-error A caller-owned optional property may be absent.
const unsafeOptionalArray: readonly ScreenDefinition[] =
  defineScreen(optionalVariants);
// @ts-expect-error A generic wrapper retains optional-property absence.
const unsafeGenericOptionalArray: readonly ScreenDefinition[] =
  defineThroughGeneric(optionalVariants);
// @ts-expect-error A caller-owned optional property may contain an array.
const unsafeOptionalDefinition: ScreenDefinition =
  defineThroughGeneric(optionalVariants);
declare const unionInput:
  | typeof screenInputBase
  | (typeof screenInputBase & {
      variants: readonly ScreenVariantInput[];
    });
const unionDefinitions: ScreenDefinition | readonly ScreenDefinition[] =
  defineThroughGeneric(unionInput);
// @ts-expect-error A union input retains both possible return shapes.
const unsafeUnion: ScreenDefinition = defineThroughGeneric(unionInput);
const variantDefinitions: readonly ScreenDefinition[] = defineScreen({
  description: "Typed variant parent",
  desktop: node,
  id: "typed-variant-parent",
  mobile: node,
  relatedDocs: [],
  route: "typed/variant-parent.html",
  title: "Typed variant parent",
  variants: [typedVariant],
});
const definitions: RegistryDefinition[] = [
  definePage(documentPage),
  defineScreen({
    description: "Type declaration fixture",
    desktop: node,
    id: "typed-screen",
    mobile: <ReviewIgnore id="typed-ignore">{node}</ReviewIgnore>,
    relatedDocs: [],
    route: "typed/screen.html",
    title: "Typed screen",
    useCaseIds: [],
  }),
  ...variantDefinitions,
];

void [
  page(nestedPage),
  collection,
  defineCollection,
  defineRoot,
  defineUseCase,
  mockLink,
  ReviewIgnoreScope,
  reviewMaterialKey,
  screen,
  typedLink,
  childLink,
  invalidChildLink,
  invalidChildProps,
  config,
  definitions,
  singleDefinition,
  undefinedDefinition,
  emptyDefinitions,
  populatedDefinitions,
  broadDefinitions,
  unsafeBroadDefinition,
  unsafeBroadArray,
  genericSingle,
  genericUndefined,
  genericEmpty,
  unsafeGeneric,
  maybeDefinitions,
  unsafeMaybe,
  absentDefinition,
  optionalDefinitions,
  optionalGenericDefinitions,
  unsafeOptionalArray,
  unsafeGenericOptionalArray,
  unsafeOptionalDefinition,
  unionDefinitions,
  unsafeUnion,
];

type PublicTypes =
  | CollectionDefinition
  | CollectionInput
  | CompatibilityConfig
  | CompatibilityTransformInput
  | EntryInput
  | PageInput
  | PageDefinition
  | NestedPageInput
  | ModuleLoader
  | ModuleResolutionConfig
  | RegistryDefinition
  | RenderInput
  | ReviewConfig
  | RootInput
  | RoutedEntryInput
  | ScreenDefinition
  | ScreenInput
  | ScreenVariantInput
  | StylesheetRule
  | UseCaseDefinition
  | UseCaseInput
  | UseCaseStep
  | Viewport
  | WatchAction
  | WatchConfig
  | WatchRule;

const renderer: Renderer = (input) =>
  `<html><body>${input.entry.title}</body></html>`;
const compatibilityTransformer: CompatibilityTransformer = (input) =>
  input.content;
const exhaustive:
  PublicTypes | Renderer | CompatibilityTransformer | undefined =
  compatibilityTransformer ?? renderer;
void exhaustive;

// @ts-expect-error Pages cannot declare screen variants.
const unsupportedPage: PageInput = { ...documentPage, mobile: node };
// @ts-expect-error Legacy configuration was removed, including undefined.
const obsoleteConfig: MoklyConfig = { ...config, legacy: undefined };
const asynchronousPage: PageInput = {
  ...documentPage,
  // @ts-expect-error Page callbacks must be synchronous complete HTML strings.
  render: async () => "<html/>",
};
void [unsupportedPage, obsoleteConfig, asynchronousPage];
