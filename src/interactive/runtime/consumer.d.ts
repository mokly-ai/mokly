declare module "mokly:interactive-consumer" {
  import type { RegistryDefinition } from "../../authoring/types.js";
  import type { InteractiveRenderer } from "../../renderer/types.js";

  export const definitions: readonly RegistryDefinition[];
  export const interactiveRenderer: InteractiveRenderer | undefined;
}
