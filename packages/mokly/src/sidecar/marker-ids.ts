import type { RenderSession } from "../authoring/runtime.js";

/** Authored ignore ids cannot collide with generated instance, slot, or link ids. */
export function uniqueMarkerIds(session: RenderSession): void {
  const all = new Set<string>();
  const authored = new Set<string>();
  for (const comment of session.markers.values()) {
    const match =
      /^mokly-(instance|slot|link|output|ignore):start id="([^"]+)"/.exec(
        comment,
      );
    if (!match) continue;
    all.add(match[2]!);
    if (match[1] === "ignore") authored.add(match[2]!);
  }
  const remapped = new Map<string, string>();
  let next = 1;
  for (const comment of session.markers.values()) {
    const match = /^mokly-(instance|slot|link|output):start id="([^"]+)"/.exec(
      comment,
    );
    const previous = match?.[2];
    if (!previous || !authored.has(previous) || remapped.has(previous))
      continue;
    while (all.has(`r-${next}`)) next += 1;
    const id = `r-${next++}`;
    all.add(id);
    remapped.set(previous, id);
  }
  if (!remapped.size) return;
  const id = (value: string) => remapped.get(value) ?? value;
  for (const [token, comment] of session.markers) {
    const rewritten = comment.replace(
      /^(mokly-(instance|slot|link|output):(start|end) id=")([^"]+)(")/,
      (
        _,
        prefix: string,
        _kind: string,
        _phase: string,
        value: string,
        suffix: string,
      ) => `${prefix}${id(value)}${suffix}`,
    );
    session.markers.set(
      token,
      rewritten.startsWith("mokly-slot:start")
        ? rewritten.replace(
            /instance="([^"]+)"/,
            (_, value: string) => `instance="${id(value)}"`,
          )
        : rewritten,
    );
  }
  for (const instance of session.instances)
    instance.regionId = id(instance.regionId);
  for (const slot of session.slots) {
    slot.instanceRegionId = id(slot.instanceRegionId);
    slot.regionIds = slot.regionIds.map(id);
  }
}
