import { platformPackage } from "../packages/mokly/src/platform.mjs";

/** Generated package trees needed by development on the current host. */
export function developmentInventoryDirectories() {
  return [
    ...["ui", "model", "frame", "viewer", "mokly"].map(
      (name) => `packages/${name}/dist`,
    ),
    `packages/${platformPackage(process.platform, process.arch, true).replace("@mokly/", "")}/bin`,
  ];
}
