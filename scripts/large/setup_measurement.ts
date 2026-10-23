/** Synthetic clocks and RSS samples exercise the same acceptance path as real setup. */
import { setupBudget } from "./setup_budget.js";
import { observeSetup, setupSystem } from "./setup_memory.js";
import type { SetupMemory, SetupSystem } from "./setup_memory.js";
import type { ToolchainMode } from "./toolchain.js";

export interface SetupMeasurement {
  status: "measured" | "failed";
  setupMs: number;
  memory: SetupMemory | null;
  reason?: string;
}
export async function measureSetup<T>(
  mode: ToolchainMode,
  work: () => Promise<T>,
  boundary: SetupSystem = setupSystem,
) {
  const beginning = boundary.now();
  const finish =
    mode === "install" ? observeSetup(boundary, beginning) : undefined;
  let outcome: { ok: true; value: T } | { ok: false; error: unknown };
  try {
    outcome = { ok: true, value: await work() };
  } catch (error) {
    outcome = { ok: false, error };
  }
  const memory = (await finish?.()) ?? null;
  const setupMs = boundary.now() - beginning;
  const reason = !outcome.ok
    ? String(outcome.error)
    : (memory?.error ??
      (mode === "install"
        ? setupBudget(setupMs, memory?.peakKiB ?? NaN)
        : undefined));
  const measurement: SetupMeasurement = {
    status: reason ? "failed" : "measured",
    setupMs,
    memory,
    ...(reason ? { reason } : {}),
  };
  return { outcome, measurement };
}
