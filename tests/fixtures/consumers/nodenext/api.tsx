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
  dependencies: [],
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
const variantDefinitions: readonly ScreenDefinition[] = defineScreen({
  dependencies: [],
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
    dependencies: [],
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
