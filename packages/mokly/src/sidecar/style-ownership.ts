import type { StyleAttribution } from "../generated/sidecar/StyleAttribution.js";

/** Adapter identities join all users even when the adapter inserts CSS only once. */
export class StyleOwners {
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

  records(read?: (identity: string) => string | undefined): StyleAttribution[] {
    const records = new Map<string, StyleAttribution>();
    for (const [identity, rule] of this.rules) {
      const css = read ? read(identity) : rule.css;
      if (!css) continue;
      for (const owner of rule.owners) {
        const owners = owner === undefined ? [] : [owner];
        records.set(JSON.stringify([css, owners]), { css, owners });
      }
    }
    return [...records]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([, record]) => record);
  }
}
