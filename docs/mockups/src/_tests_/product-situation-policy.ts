/** Validate situation ownership independently of the derived product inventory. */

import { productFamilies } from "./product-families";

export interface ProductSituationIdentity {
  path: string;
  family: keyof typeof productFamilies;
  screen: string;
  name: string;
  parent?: string;
}

export function situationIdentityViolations(
  situations: readonly ProductSituationIdentity[],
): string[] {
  const problems: string[] = [];
  const byPath = new Map(
    situations.map((situation) => [situation.path, situation]),
  );
  if (byPath.size !== situations.length)
    problems.push("duplicate situation path");
  for (const situation of situations) {
    const owner = "product/" + situation.family + "/" + situation.screen;
    const screens: readonly string[] = productFamilies[situation.family];
    if (!screens.includes(situation.screen))
      problems.push("situation names a known screen: " + situation.path);
    if (!situation.path.startsWith(owner + "/"))
      problems.push(
        "situation stays under its owning screen: " + situation.path,
      );
    const parent = situation.parent ? byPath.get(situation.parent) : undefined;
    if (
      situation.parent &&
      (!parent ||
        parent.family !== situation.family ||
        parent.screen !== situation.screen)
    )
      problems.push(
        "situation needs a parent with the same owner: " + situation.path,
      );
    const base = situation.parent ?? owner;
    const siblingRecovery =
      situation.path === "product/settings/workspace/slug-recovery" &&
      situation.parent === "product/settings/workspace/slug" &&
      situation.name === "recovery";
    if (!siblingRecovery && situation.path !== base + "/" + situation.name)
      problems.push(
        "situation path matches its screen or parent: " + situation.path,
      );
  }
  return problems;
}
