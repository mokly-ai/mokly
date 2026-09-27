/** Discover transitive resource ownership from inferred inline rule groups. */
import type { ComponentMaterialReader } from "./component_resources.js";
import type { InlineAttributionResult } from "./css/inline_attribution.js";
import { inlineOwnedRuleGroups } from "./css/inline_owned_rules.js";
import { renderInlineRules } from "./css/inline_rendering.js";

/** Repository-relative resource paths mapped to every inferred component owner. */
export type InlineResourceOwners = ReadonlyMap<string, ReadonlySet<string>>;

/** Traverse each distinct owner set through the ordinary per-side resource graph. */
export async function discoverInlineResourceOwners(
  analysis: InlineAttributionResult | undefined,
  before: { path: string; reader: ComponentMaterialReader },
  after: { path: string; reader: ComponentMaterialReader },
  prefix: string,
): Promise<InlineResourceOwners> {
  const discoveries = await Promise.all(
    (
      [
        ["before", before],
        ["after", after],
      ] as const
    ).flatMap(([side, source]) =>
      inlineOwnedRuleGroups(analysis, side).map(async (group) => ({
        componentIds: group.componentIds,
        resources: await source.reader.resources(
          source.path,
          `<style>${renderInlineRules(group.rules)}</style>`,
        ),
      })),
    ),
  );
  const owners = new Map<string, Set<string>>();
  for (const discovery of discoveries)
    for (const route of discovery.resources) {
      const path = prefix ? `${prefix}/${route}` : route;
      const componentIds = owners.get(path) ?? new Set<string>();
      for (const id of discovery.componentIds) componentIds.add(id);
      owners.set(path, componentIds);
    }
  return owners;
}
