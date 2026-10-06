/** Usage retained by a current entry or by a removed record in this catalogue. */

import type { BranchPointPath, CurrentPath } from "../catalogue/path_types.js";
import type {
  ComponentInstanceRecord,
  ComponentViewRecord,
} from "../components/manifest_types.js";
import type { GeneratedComponentView } from "../components/views.js";

export type ShellUsageReference = CurrentPath | BranchPointPath;
export type ShellInstance = ComponentInstanceRecord<ShellUsageReference>;
export type ShellUsage = ComponentViewRecord<ShellUsageReference>;
export type ShellGeneratedView = GeneratedComponentView<
  CurrentPath,
  ShellUsageReference
>;
