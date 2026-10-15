import type { PackedRelease } from "./package_set.mjs";
export function publishPackages(
  root: string,
  packages: PackedRelease[],
  dependencies?: {
    verify?: (options: {
      localReport: PackedRelease["report"];
      repositoryRoot: string;
      mode: "guard" | "verify";
      distTag?: string;
    }) => Promise<boolean>;
    execute?: (
      file: string,
      args: string[],
      options: { cwd: string },
    ) => Promise<unknown>;
  },
): Promise<void>;
