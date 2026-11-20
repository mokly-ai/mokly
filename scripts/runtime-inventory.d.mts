/** Generated record of a package's complete runtime outputs. */
export const RUNTIME_INVENTORY: string;

/** Write the inventory only after every package build step succeeds. */
export function writeRuntimeInventory(directory: string): Promise<void>;

/** Check the complete generated tree, including each file's content digest. */
export function runtimeInventoryComplete(directory: string): Promise<boolean>;
