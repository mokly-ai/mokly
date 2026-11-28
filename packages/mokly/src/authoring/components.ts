import type { ReactNode } from "react";

import { validatePropValues } from "@mokly/viewer/data";

import { SidecarError, detail } from "../sidecar/errors.js";

import { copyData } from "./data.js";
import { withAuthoringErrors } from "./errors.js";
import { resolveWrapperInstanceId } from "./instance-names.js";
import { validateDestination } from "./links.js";
import type { AuthoringRuntime, DefinitionData, Owner } from "./runtime.js";
import { wrapperBrand } from "./runtime.js";
import {
  rememberedSlot,
  rememberSlot,
  slotRegion,
  suppliedSlot,
} from "./supplied-slots.js";
import {
  instancePlacement,
  instanceProps,
  invocationSource,
  renderInstance,
} from "./usage.js";

/** Render an adapter under instance ownership, while slots retain input ownership. */
export function componentWrapper(definition: object, data: DefinitionData) {
  const runtime = data.runtime;
  const React = runtime.react;
  function Component(input: Record<string, unknown>): ReactNode {
    return withAuthoringErrors(() => {
      const session = runtime.session();
      const parent = React.useContext(runtime.contexts.owner);
      const registered = session.registrations.get(definition);
      if (!registered)
        throw new Error(
          `unexported component ${data.input.title} from ${data.source ?? "unknown module"}`,
        );
      if (!registered.path)
        throw new Error(
          `component ${registered.handle} requires its resolved catalogue path`,
        );
      validateDestination(registered.path);
      const { moklyInstance, __moklySource, __moklyKey, ...supplied } = input;
      const { id, numbered } = resolveWrapperInstanceId(
        registered.path.split("/").at(-1)!,
        parent.seen,
        moklyInstance,
        __moklyKey,
      );
      const placement = instancePlacement(session, parent, id);
      const props: Record<string, unknown> = {};
      const slotProps: Record<string, ReactNode> = {};
      const names = (data.input.slots ?? []) as string[];
      for (const [name, value] of Object.entries(supplied)) {
        if (names.includes(name))
          slotProps[name] = wrapSlot(
            runtime,
            value as ReactNode,
            parent,
            placement.key,
            placement.regionId,
            name,
          );
        else props[name] = value;
      }
      const normalized = copyData(props) as Record<string, unknown>;
      // The core accepted this definition before it installed render bindings.
      const schema = data.input.propSchema as Parameters<
        typeof validatePropValues
      >[0];
      try {
        validatePropValues(schema, normalized, registered.path);
      } catch (error) {
        throw new SidecarError(
          "component-props",
          `${session.location}: ${detail(error)}`,
        );
      }
      const source = invocationSource(
        __moklySource,
        session.sourceRoot,
        session.dependencyRoots,
      );
      const draft = {
        ...placement,
        componentPath: registered.path,
        ...instanceProps(normalized),
        ...(numbered ? { numbered } : {}),
        ...(source ? { source } : {}),
      };
      const render = data.input.render as (
        props: Record<string, unknown>,
        context: unknown,
      ) => ReactNode;
      function Adapter() {
        return render(
          { ...(copyData(normalized) as object), ...slotProps },
          session.context,
        );
      }
      const capture = React.useContext(runtime.contexts.styles);
      return renderInstance(
        runtime,
        session,
        draft,
        React.createElement(Adapter),
        capture,
      );
    });
  }
  Object.defineProperty(Component, wrapperBrand, { value: true });
  return Component;
}

function wrapSlot(
  runtime: AuthoringRuntime,
  node: ReactNode,
  parent: Owner,
  instance: string,
  region: string,
  name: string,
): ReactNode {
  const React = runtime.react;
  const session = runtime.session();
  const placement = suppliedSlot(
    session,
    parent,
    instance,
    region,
    name,
    rememberedSlot(node),
  );
  function Slot() {
    return withAuthoringErrors(() => {
      const capture = React.useContext(runtime.contexts.styles);
      return slotRegion(runtime, session, placement, capture)(node);
    });
  }
  const wrapped = React.createElement(Slot);
  rememberSlot(wrapped, placement);
  return wrapped;
}
