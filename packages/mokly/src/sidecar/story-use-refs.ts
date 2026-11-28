import type { RenderSession } from "../authoring/runtime.js";

import type { Invocation, Props } from "./story-use-invocation.js";

type RefCandidates = Map<Invocation, ReadonlyMap<string, unknown>>;

interface RefUses {
  byRef: WeakMap<object, RefCandidates>;
  refByUse: WeakMap<Invocation, object | null>;
}

function refUses(): RefUses {
  return { byRef: new WeakMap(), refByUse: new WeakMap() };
}

function refKey(value: unknown): value is object {
  return (
    typeof value === "function" || (typeof value === "object" && value !== null)
  );
}

export class StoryUseRefs {
  private readonly moduleRefs = refUses();
  private readonly renders = new WeakMap<RenderSession, RefUses>();

  record(
    props: Props,
    use: Invocation,
    session: RenderSession | undefined,
    replaces?: Invocation,
  ): void {
    const value = props.ref;
    const ref = refKey(value) ? value : undefined;
    if (!ref && !replaces) return;
    const refs = session ? this.forRender(session) : this.moduleRefs;
    if (replaces) {
      const priorRef = refs.refByUse.get(replaces);
      if (priorRef) refs.byRef.get(priorRef)?.delete(replaces);
      refs.refByUse.set(replaces, null);
    }
    if (!ref) return;
    const fields = new Map<string, unknown>(Object.entries(props));
    fields.delete("ref");
    const records = refs.byRef.get(ref);
    if (records) records.set(use, fields);
    else refs.byRef.set(ref, new Map([[use, fields]]));
    refs.refByUse.set(use, ref);
  }

  match(
    props: object,
    ref: unknown,
    session: RenderSession | undefined,
    registered: (type: object) => boolean,
  ): Invocation | undefined {
    if (!session || !refKey(ref)) return;
    const render = this.renders.get(session);
    const moduleRecords = this.moduleRefs.byRef.get(ref);
    const renderRecords = render?.byRef.get(ref);
    if (!moduleRecords && !renderRecords) return;
    const candidates = [...(renderRecords ?? [])];
    for (const [use, recorded] of moduleRecords ?? [])
      if (!render?.refByUse.has(use)) candidates.push([use, recorded]);
    const fields: [string, unknown][] = Object.entries(props);
    let match: Invocation | undefined;
    for (const [use, recorded] of candidates) {
      if (
        recorded.size !== fields.length ||
        !fields.every(
          ([key, value]) => recorded.has(key) && recorded.get(key) === value,
        ) ||
        !registered(use.type)
      )
        continue;
      if (match) return;
      match = use;
    }
    return match;
  }

  private forRender(session: RenderSession): RefUses {
    let refs = this.renders.get(session);
    if (!refs) {
      refs = refUses();
      this.renders.set(session, refs);
    }
    return refs;
  }
}
