import { largeSize } from "../../tests/fixtures/large/dimensions.js";
import type {
  LargeSize,
  Variant,
} from "../../tests/fixtures/large/dimensions.js";

import { scenarios } from "./benchmark.js";
import type { Scenario } from "./benchmark.js";
import type { ToolchainMode } from "./toolchain.js";

export function options(args: string[]) {
  const rest = [...args];
  const mode = rest.shift();
  if (mode !== "generate" && mode !== "benchmark")
    throw new Error("Use generate or benchmark");
  let variant: Variant = "html",
    toolchain: ToolchainMode = "workspace",
    root: string | undefined;
  let sidecars = 2,
    selected: readonly Scenario[] = scenarios;
  const input: Partial<LargeSize> = {};
  while (rest.length) {
    const flag = rest.shift()!;
    const value = rest.shift();
    if (!value || value.startsWith("--"))
      throw new Error(`${flag} needs a value`);
    if (flag === "--root") root = value;
    else if (flag === "--variant" && (value === "html" || value === "react"))
      variant = value;
    else if (
      flag === "--toolchain" &&
      (value === "workspace" || value === "install")
    )
      toolchain = value;
    else if (
      flag === "--scenario" &&
      (value === "all" || scenarios.includes(value as Scenario))
    )
      selected = value === "all" ? scenarios : [value as Scenario];
    else if (flag === "--sidecars") {
      sidecars = Number(value);
      if (!Number.isSafeInteger(sidecars) || sidecars < 1)
        throw new Error("--sidecars needs a positive integer");
    } else if (
      [
        "--areas",
        "--screens",
        "--rows",
        "--stylesheets",
        "--stylesheet-share",
      ].includes(flag)
    ) {
      const name =
        flag === "--stylesheet-share"
          ? "stylesheetShare"
          : (flag.slice(2) as keyof LargeSize);
      input[name] = Number(value);
    } else throw new Error(`Unknown fixture option or value: ${flag} ${value}`);
  }
  return {
    mode,
    variant,
    toolchain,
    root,
    sidecars,
    selected,
    size: largeSize(input),
  };
}
