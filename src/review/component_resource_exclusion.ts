/** Paired explicit non-CSS owners can suppress resource bytes in projection. */
import {
  canonicalJson,
  isStylesheetPath,
  type GeneratedComponentView,
} from "@mokly/viewer/data";

export function projectedResourceExclusion(
  before: GeneratedComponentView,
  after: GeneratedComponentView,
  paired: ReadonlySet<string>,
  root?: string,
): (path: string) => boolean {
  return (path) => {
    if (isStylesheetPath(path) || !before.usage || !after.usage) return false;
    const left = before.usage.resources.find((item) => item.path === path);
    const right = after.usage.resources.find((item) => item.path === path);
    return Boolean(
      left &&
      right &&
      canonicalJson(left.componentIds) === canonicalJson(right.componentIds) &&
      left.componentIds.every((id) => id !== root && paired.has(id)),
    );
  };
}
