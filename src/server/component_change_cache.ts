import type {
  ComponentChangeSnapshot,
  ComponentChangeSource,
} from "./component_change_types.js";

/** Retain one immutable classification; resolving the baseline never creates Review artifacts. */
export class ComponentChangeCache {
  private cached:
    | {
        sequence: number;
        key: string;
        result: Promise<ComponentChangeSnapshot | undefined>;
      }
    | undefined;
  private epoch = 0;
  private sequence = 0;
  constructor(private readonly source: ComponentChangeSource) {}
  invalidate(): void {
    this.epoch++;
    this.cached = undefined;
  }
  async read(generation: number): Promise<ComponentChangeSnapshot | undefined> {
    const epoch = this.epoch;
    const sequence = ++this.sequence;
    try {
      const baseline = await this.source.baseline();
      const key = `${epoch}:${generation}:${baseline}`;
      if (this.cached?.key === key) return this.cached.result;
      const result = this.source.read(baseline).catch(() => undefined);
      if (epoch === this.epoch && sequence >= (this.cached?.sequence ?? 0))
        this.cached = { sequence, key, result };
      return result;
    } catch {
      return undefined;
    }
  }
}
