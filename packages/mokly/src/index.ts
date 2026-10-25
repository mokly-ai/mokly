import { linkHelpers } from "./authoring/links.js";
import { markerHelpers } from "./authoring/markers.js";
import { defaultRuntime } from "./authoring/runtime.js";

export {
  defineComponent,
  defineFolder,
  definePage,
  defineScreen,
  defineUseCase,
} from "./authoring/definitions.js";
export { reviewMaterialKey } from "./authoring/data.js";
export type * from "./authoring/types.js";
export type * from "./authoring/config.js";
export type { MockLinkProps } from "./authoring/links.js";
export type {
  ReviewIgnoreProps,
  ReviewIgnoreScopeProps,
} from "./authoring/markers.js";

export const { MockLink, mockLink } = linkHelpers(defaultRuntime);
export const { ReviewIgnore, ReviewIgnoreScope } =
  markerHelpers(defaultRuntime);
