import type { StyleAttribution } from "../generated/sidecar/StyleAttribution.js";

export type InlineAttribution = (
  css: string,
  attributes: readonly { name: string; value: string }[],
) => StyleAttribution[] | undefined;

/** Adapter identities join all users even when the adapter inserts CSS only once. */
export class StyleOwners {
  private dependencies = new Map<string, Set<string>>();
  private rules = new Map<
    string,
    { css?: string; owners: Set<string | undefined> }
  >();

  use(identity: string, owner: string | undefined, css?: string) {
    let rule = this.rules.get(identity);
    if (!rule) {
      rule = { owners: new Set() };
      this.rules.set(identity, rule);
    }
    rule.owners.add(owner);
    if (css !== undefined) rule.css = css;
  }

  link(identity: string, dependency: string) {
    let edges = this.dependencies.get(identity);
    if (!edges) this.dependencies.set(identity, (edges = new Set()));
    edges.add(dependency);
  }

  *entries(
    read?: (identity: string) => string | undefined,
  ): Generator<[string, StyleAttribution]> {
    const pending = [...this.rules.keys()];
    for (let cursor = 0; cursor < pending.length; cursor++) {
      const identity = pending[cursor]!;
      const source = this.rules.get(identity)!;
      for (const dependency of this.dependencies.get(identity) ?? []) {
        const target = this.rules.get(dependency);
        if (!target) continue;
        for (const owner of source.owners) {
          if (target.owners.has(owner)) continue;
          target.owners.add(owner);
          pending.push(dependency);
        }
      }
    }
    for (const [identity, rule] of this.rules) {
      const css = read ? read(identity) : rule.css;
      if (!css) continue;
      for (const owner of rule.owners) {
        const owners = owner === undefined ? [] : [owner];
        yield [identity, { css, owners }];
      }
    }
  }

  records(read?: (identity: string) => string | undefined): StyleAttribution[] {
    const records = new Map<string, StyleAttribution>();
    for (const [, record] of this.entries(read))
      records.set(JSON.stringify([record.css, record.owners]), record);
    return [...records]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([, record]) => record);
  }
}
