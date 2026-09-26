import type { BuildWarning } from "./warnings.js";

/** Deduplicate one invocation or watched generation before terminal reporting. */
export class BuildWarningSink {
  private readonly seen = new Set<string>();
  private readonly pending = new Map<string, BuildWarning>();
  private live = false;

  constructor(private readonly report: (warning: BuildWarning) => void) {}

  add(warning: BuildWarning): void {
    const key = JSON.stringify([warning.code, ...warning.context]);
    if (this.seen.has(key)) return;
    this.seen.add(key);
    if (this.live) this.report(warning);
    else this.pending.set(key, warning);
  }

  flush(): void {
    for (const key of [...this.pending.keys()].sort())
      this.report(this.pending.get(key)!);
    this.pending.clear();
    this.live = true;
  }

  reset(): void {
    this.seen.clear();
    this.pending.clear();
    this.live = false;
  }
}
