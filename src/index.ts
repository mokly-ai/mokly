export { defineConfig } from "./config/define.js";
export type {
  CompatibilityConfig,
  ModuleLoader,
  ModuleResolutionConfig,
  MoklyConfig,
  ReviewConfig,
  StylesheetRule,
  WatchAction,
  WatchConfig,
  WatchRule,
} from "./config/types.js";
export {
  collection,
  defineCollection,
  defineRoot,
  definePage,
  page,
  defineScreen,
  defineUseCase,
  screen,
} from "./authoring/definitions.js";
export { MockLink, mockLink } from "./authoring/links.js";
export { ReviewIgnore, ReviewIgnoreScope } from "./authoring/review_ignore.js";
export { reviewMaterialKey } from "@mokly/viewer/data";
export type {
  PageInput,
  PageDefinition,
  NestedPageInput,
  CollectionDefinition,
  CollectionInput,
  EntryInput,
  NestedCollectionInput,
  NestedScreenInput,
  RegistryDefinition,
  RootInput,
  RoutedEntryInput,
  ScreenDefinition,
  ScreenInput,
  UseCaseDefinition,
  UseCaseInput,
  UseCaseStep,
} from "./authoring/types.js";
export type { ColorScheme, Viewport } from "@mokly/viewer";
export { defineComponent } from "./components/definition.js";
export { resolveInstance } from "@mokly/viewer";
export type { InstanceResolution } from "@mokly/viewer";
export type {
  ComponentDefinition,
  ComponentInput,
  ComponentProps,
  ComponentRenderContext,
  ComponentVariant,
  RegisteredComponent,
} from "./components/types.js";
export type {
  ComponentControl,
  ComponentControlLabel,
  ControlFor,
} from "@mokly/viewer";
export type {
  ComponentPropsData,
  DataPropField,
  DataPropSchema,
  InferProp,
  ObjectPropSchema,
  PropPrimitive,
  PropValue,
} from "@mokly/viewer";
export type {
  ComponentInstanceRecord,
  ComponentSourceLocation,
  ComponentStyleOwnership,
  ComponentResourceOwnership,
} from "@mokly/viewer";
export type { Renderer, RenderInput, RenderResult } from "./renderer/types.js";
export type {
  CompatibilityTransformer,
  CompatibilityTransformInput,
} from "./compatibility/types.js";
