/** Shared traversal of portable local resource references. */

/** Resource edges supplied by a caller's validation and normalization policy. */
export interface ResourceReferenceReader {
  readReferences(route: string): Promise<readonly string[]>;
  prefetch?(routes: readonly string[]): Promise<void>;
}

/** Cache shared edges while visiting every reachable resource, including cycles. */
export class ResourceGraph {
  readonly #references = new Map<string, Promise<readonly string[]>>();

  constructor(private readonly reader: ResourceReferenceReader) {}

  collect(seeds: readonly string[]): Promise<ReadonlySet<string>>;
  collect(
    seeds: readonly string[],
    available: (routes: readonly string[]) => Promise<boolean>,
  ): Promise<ReadonlySet<string> | undefined>;
  /** A proof validates each frontier before required edge discovery, including transitive files. */
  async collect(
    seeds: readonly string[],
    available?: (routes: readonly string[]) => Promise<boolean>,
  ): Promise<ReadonlySet<string> | undefined> {
    let pending = [...seeds];
    const seen = new Set<string>();
    while (pending.length) {
      const batch = [...new Set(pending)].filter((route) => !seen.has(route));
      const unread = batch.filter((route) => !this.#references.has(route));
      if (available && !(await available(unread))) return;
      await this.reader.prefetch?.(unread);
      pending = [];
      for (const route of batch) {
        seen.add(route);
        let references = this.#references.get(route);
        if (!references) {
          references = this.reader.readReferences(route);
          this.#references.set(route, references);
        }
        pending.push(...(await references));
      }
    }
    return seen;
  }
}
