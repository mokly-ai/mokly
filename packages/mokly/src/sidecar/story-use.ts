import type { ReactElement } from "react";
import type { jsx } from "react/jsx-runtime";

import { resolveInstanceId } from "../authoring/instance-names.js";
import type { RenderSession } from "../authoring/runtime.js";
import {
  instancePlacement,
  instanceProps,
  invocationSource,
  renderInstance,
} from "../authoring/usage.js";

import type { Generation } from "./bundle.js";
import { dataProps } from "./definition-fields.js";
import { storyComponentPath, storyComponentType } from "./story-components.js";

export function wrapStoryUse(generation: Generation) {
  return (
    element: ReactElement<Record<string, unknown>>,
    key: unknown,
    source: unknown,
    create: typeof jsx,
  ): ReactElement => {
    const type = element.type;
    if (!generation.params.storiesFiles.length || !storyComponentType(type))
      return element;
    const handles = generation.definitions
      ? generation.storyComponents.handles(type)
      : undefined;
    if (handles?.length === 0) return element;

    const runtime = generation.runtime;
    const React = runtime.react;
    const outerProps = { ...element.props };
    const StoryUse = (props: typeof outerProps) => {
      const session = React.useContext(runtime.contexts.session);
      const parent = React.useContext(runtime.contexts.owner);
      const capture = React.useContext(runtime.contexts.styles);
      const original =
        props === outerProps ? element : React.cloneElement(element, props);
      const entries = generation.bindings;
      if (!session || !entries) return original;
      const componentPath = storyComponentPath(
        handles ?? generation.storyComponents.handles(type),
        entries,
        session.storyComponentHandle,
      );
      if (!componentPath) return original;
      const segment = componentPath.split("/").at(-1)!;
      const { id, numbered } = resolveInstanceId(
        segment,
        parent.seen,
        key,
        props,
        generation.params.instanceNameProps,
      );
      const site = storyInvocationSource(source, session);
      return renderInstance(
        runtime,
        session,
        {
          ...instancePlacement(session, parent, id),
          componentPath,
          ...instanceProps(storyUseDataProps(props)),
          ...(numbered ? { numbered } : {}),
          ...(site ? { source: site } : {}),
        },
        original,
        capture,
      );
    };
    return create(StoryUse, outerProps, element.key ?? undefined);
  };
}

function storyUseDataProps(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const inputs = Object.fromEntries(
    Object.entries(props).filter(([, value]) => typeof value !== "function"),
  );
  return dataProps(inputs, false);
}

function storyInvocationSource(source: unknown, session: RenderSession) {
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
