import type { ReactNode } from "react";

import { resolveInstanceId } from "../authoring/instance-names.js";
import type { RenderSession } from "../authoring/runtime.js";
import { slotRegion, supplierStyleOwner } from "../authoring/supplied-slots.js";
import {
  instancePlacement,
  instanceProps,
  instanceRegion,
  invocationSource,
} from "../authoring/usage.js";
import type { InstanceDraft } from "../generated/sidecar/InstanceDraft.js";

import type { Generation } from "./bundle.js";
import { originalSlot, storyUseContent } from "./story-use-content.js";
import {
  storyInvocation,
  type CreateSuppliedElement,
  type Invocation,
  type Props,
} from "./story-use-invocation.js";
import { storyUseDataProps } from "./story-use-props.js";

export interface PreparedStoryUse {
  props: Props;
  run(body: () => ReactNode): ReactNode;
  finish(output: ReactNode): ReactNode;
}

export function prepareStoryUse(
  generation: Generation,
  input: Props,
  use: Invocation,
  instrumented: (type: object) => boolean,
  create: CreateSuppliedElement,
): PreparedStoryUse {
  const { runtime } = generation;
  const React = runtime.react;
  const { [storyInvocation]: _invocation, ...clean } = input;
  const session = React.use(runtime.contexts.session);
  const surrounding = React.use(runtime.contexts.owner);
  const capture = React.use(runtime.contexts.styles);
  if (!session)
    return { props: clean, run: (body) => body(), finish: (output) => output };

  const supplier = originalSlot(use.slots);
  const parent = supplier ?? surrounding;
  const component =
    generation.bindings &&
    generation.storyComponents.entry(
      use.type,
      generation.bindings,
      session.storyComponentHandle,
    );
  let props = clean;
  let draft: InstanceDraft | undefined;
  if (component) {
    const componentPath = component.path;
    const { id, numbered } = resolveInstanceId(
      componentPath.split("/").at(-1)!,
      parent.seen,
      use.key,
      clean,
      generation.params.instanceNameProps,
    );
    const placement = instancePlacement(session, parent, id);
    const content = component.contentSlots
      ? storyUseContent(
          runtime,
          session,
          clean,
          parent,
          placement,
          instrumented,
          create,
        )
      : { output: clean, data: clean };
    const source = storySource(use.source, session);
    props = content.output;
    draft = {
      ...placement,
      componentPath,
      ...instanceProps(storyUseDataProps(content.data, React.isValidElement)),
      ...(numbered ? { numbered } : {}),
      ...(source ? { source } : {}),
    };
  }

  const styleOwner =
    component?.path ??
    (supplier && supplierStyleOwner(supplier, session, capture));
  let regions: ((output: ReactNode) => ReactNode)[] | undefined;
  return {
    props,
    run(body) {
      return capture && (draft || supplier)
        ? capture.run(styleOwner, body)
        : body();
    },
    finish(output) {
      if (!regions) {
        regions = [];
        if (draft)
          regions.push(instanceRegion(runtime, session, draft, capture));
        for (const slot of use.slots)
          regions.push(slotRegion(runtime, session, slot, capture));
      }
      return regions.reduce((node, wrap) => wrap(node), output);
    },
  };
}

function storySource(source: unknown, session: RenderSession) {
  try {
    return invocationSource(
      source,
      session.sourceRoot,
      session.dependencyRoots,
    );
  } catch {
    return undefined;
  }
}
