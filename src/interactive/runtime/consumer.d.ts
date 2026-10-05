declare module "mokly:interactive-consumer" {
  import type { InteractiveRenderer } from "../../renderer/types.js";

  import type { InteractiveEntryModule } from "./definitions.js";

  export const modules: readonly InteractiveEntryModule[];
  export const interactiveRenderer: InteractiveRenderer | undefined;
}
