import type { runInherited } from "./process.mjs";

/** The compiler command shared by every project in one typecheck run. */
export interface TypecheckOptions {
  root: string;
  program: string;
  args: readonly string[];
  execute?: typeof runInherited;
}

/** Run each project in order and return the first unsuccessful process status. */
export function runTypecheck(options: TypecheckOptions): Promise<number>;
