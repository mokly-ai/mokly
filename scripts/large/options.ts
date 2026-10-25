import { largeSize } from "../../tests/fixtures/large/dimensions.js";
import type {
  LargeSize,
  Variant,
} from "../../tests/fixtures/large/dimensions.js";

import { parseScenario, scenarios } from "./benchmark.js";
import type { Scenario } from "./benchmark.js";
import { DEFAULT_MEMORY_STOP_KIB } from "./memory.js";
import type { ToolchainMode } from "./toolchain.js";

export function options(args: string[]) {
  const rest = [...args];
  const mode = rest.shift();
  if (mode !== "generate" && mode !== "benchmark")
    throw new Error("Use generate or benchmark");
  let variant: Variant = "html",
    toolchain: ToolchainMode = "workspace",
    root: string | undefined;
  let memoryStopKiB = DEFAULT_MEMORY_STOP_KIB,
    sidecarTimeoutMs: number | undefined;
  let sidecars = 2,
    selected: readonly Scenario[] = scenarios;
  const input: Partial<LargeSize> = {};
  while (rest.length) {
    const flag = rest.shift()!;
    const generateFlags = [
      "--variant",
      "--toolchain",
      "--areas",
      "--screens",
      "--rows",
      "--stylesheets",
      "--stylesheet-share",
    ];
    const benchmarkFlags = [
      "--scenario",
      "--sidecars",
      "--memory-stop-kib",
      "--sidecar-timeout-ms",
    ];
    if (
      (mode === "benchmark" && generateFlags.includes(flag)) ||
      (mode === "generate" && benchmarkFlags.includes(flag))
    )
      throw new Error(`${flag} is not used by ${mode}`);
    const value = rest.shift();
    if (!value || value.startsWith("--"))
      throw new Error(`${flag} needs a value`);
    if (flag === "--root") root = value;
    else if (flag === "--memory-stop-kib") {
      memoryStopKiB = Number(value);
      if (!Number.isSafeInteger(memoryStopKiB) || memoryStopKiB < 0)
        throw new Error("--memory-stop-kib needs a non-negative integer");
    } else if (flag === "--sidecar-timeout-ms") {
      sidecarTimeoutMs = Number(value);
      if (!Number.isSafeInteger(sidecarTimeoutMs) || sidecarTimeoutMs < 1)
        throw new Error("--sidecar-timeout-ms needs a positive integer");
    } else if (flag === "--variant" && (value === "html" || value === "react"))
      variant = value;
    else if (
      flag === "--toolchain" &&
      (value === "workspace" || value === "install")
    )
      toolchain = value;
    else if (flag === "--scenario") {
      const scenario = parseScenario(value);
      if (value === "all") selected = scenarios;
      else if (scenario) selected = [scenario];
      else throw new Error(`Unknown fixture option or value: ${flag} ${value}`);
    } else if (flag === "--sidecars") {
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
    memoryStopKiB,
    ...(sidecarTimeoutMs === undefined ? {} : { sidecarTimeoutMs }),
    selected,
    size: largeSize(input),
  };
}
