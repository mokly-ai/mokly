import { createHash } from "node:crypto";

import { MoklyError } from "../../errors.js";

import type { CssRuleDelta } from "./match_types.js";
import type { CssRule } from "./types.js";

/** Compare tuples as well as hashes before accepting cross-stylesheet proof. */
export class CssRuleIdentities {
  private readonly tuples = new Map<string, string>();

  constructor(
    private readonly digest: (tuple: string) => string = (tuple) =>
      createHash("sha256").update(tuple, "utf8").digest("hex"),
  ) {}

  key(change: CssRuleDelta): string {
    const side = (rule?: CssRule) =>
      rule ? [rule.selectors, rule.declarations] : null;
    const tuple = JSON.stringify([
      "mokly-css-change-v1",
      side(change.before),
      side(change.after),
    ]);
    const key = this.digest(tuple);
    const previous = this.tuples.get(key);
    if (previous !== undefined && previous !== tuple)
      throw new MoklyError("review-invalid", "CSS rule identity collision");
    this.tuples.set(key, tuple);
    return key;
  }
}
