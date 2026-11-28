import { withAuthoringErrors } from "../authoring/errors.js";
import type {
  AuthoringRuntime,
  Owner,
  RenderSession,
} from "../authoring/runtime.js";
import {
  rememberedSlot,
  rememberSlot,
  slotRegion,
  suppliedSlot,
  type SlotPlacement,
} from "../authoring/supplied-slots.js";

import { storyComponentType } from "./story-components.js";
import { projectStoryContent } from "./story-content-values.js";
import { mirrorStatics } from "./story-use-bindings.js";
import {
  storyInvocation,
  invocation,
  type CreateSuppliedElement,
  type Element,
  type Props,
} from "./story-use-invocation.js";

interface ContentReceiver {
  key: string;
  regionId: string;
}

export function storyUseContent(
  runtime: AuthoringRuntime,
  session: RenderSession,
  props: Props,
  parent: Owner,
  receiver: ContentReceiver,
  instrumented: (type: object) => boolean,
  create: CreateSuppliedElement,
): { output: Props; data: Props } {
  const React = runtime.react;
  const names = new Set<string>();

  function elementSlot(element: Element, prop: string, at: string): Element {
    const label = element.key ?? at;
    const base = `${prop}-${label}`.toWellFormed().replaceAll("\0", "�");
    let name = base;
    for (let suffix = 2; names.has(name); suffix++) name = `${base}-${suffix}`;
    names.add(name);
    const type = element.type;
    const carried = invocation(element.props);
    const forwarded =
      carried?.slots.at(-1) ?? rememberedSlot(element) ?? rememberedSlot(type);
    const slot = suppliedSlot(
      session,
      parent,
      receiver.key,
      receiver.regionId,
      name,
      forwarded,
    );
    if (storyComponentType(type) && instrumented(type)) {
      const original = carried ?? {
        type,
        key: element.key,
        source: undefined,
        slots: [],
      };
      const attachment = { ...original, slots: [...original.slots, slot] };
      const marked = create(
        type,
        { ...element.props, [storyInvocation]: attachment },
        element.key ?? undefined,
        element,
      );
      rememberSlot(marked, slot);
      return marked;
    }
    const Mirror = mirrorStatics(
      (injected) =>
        withAuthoringErrors(() => {
          const capture = React.useContext(runtime.contexts.styles);
          return slotRegion(
            runtime,
            session,
            slot,
            capture,
          )(React.cloneElement(element, injected));
        }),
      type,
    );
    rememberSlot(Mirror, slot);
    return create(Mirror, { ...element.props }, element.key ?? undefined);
  }

  const output: Props = { ...props };
  const data: Props = { ...props };
  for (const [prop, value] of Object.entries(props)) {
    const projected = projectStoryContent(
      value,
      React.isValidElement,
      (element, position) => elementSlot(element, prop, position),
    );
    if (!projected) continue;
    Object.defineProperty(output, prop, {
      ...Object.getOwnPropertyDescriptor(output, prop),
      value: projected.output,
    });
    Object.defineProperty(data, prop, {
      ...Object.getOwnPropertyDescriptor(data, prop),
      value: projected.data,
    });
  }
  return { output, data };
}

export function originalSlot(
  slots: readonly SlotPlacement[],
): Owner | undefined {
  const last = slots.at(-1);
  return last && { ...last.owner, seen: new Set<string>() };
}
