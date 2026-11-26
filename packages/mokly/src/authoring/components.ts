import type { ReactNode } from "react";

import { validatePropValues } from "@mokly/viewer/data";

import type { SlotDraft } from "../generated/sidecar/SlotDraft.js";
import { SidecarError, detail } from "../sidecar/errors.js";

import { copyData, digest } from "./data.js";
import { withAuthoringErrors } from "./errors.js";
import { validateDestination } from "./links.js";
import type { AuthoringRuntime, DefinitionData, Owner } from "./runtime.js";
import { wrapperBrand } from "./runtime.js";
import {
  inputOwner,
  instancePlacement,
  instanceProps,
  invocationSource,
  renderInstance,
} from "./usage.js";

const slots = new WeakMap<object, { owner: Owner; key: string }>();

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
      const { moklyInstance, __moklySource, ...supplied } = input;
      const id = moklyInstance ?? registered.path.split("/").at(-1)!;
      if (
        typeof id !== "string" ||
        (moklyInstance !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
      )
        throw new Error("moklyInstance must be lowercase kebab-case");
      if (parent.seen.has(id)) throw new Error(`duplicate instance ${id}`);
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
  const forwarded =
    node && typeof node === "object" ? slots.get(node) : undefined;
  const React = runtime.react;
  const session = runtime.session();
  const key = digest(["mokly-slot-v1", instance, name]);
  const owner = forwarded?.owner ?? parent;
  const original: Owner = {
    ...owner,
    slotKey: owner.slotKey ?? key,
  };
  const draft: SlotDraft = {
    key,
    instanceKey: instance,
    name,
    owner: inputOwner(owner),
    ...(forwarded ? { sourceSlotKey: forwarded.key } : {}),
    instanceRegionId: region,
    regionIds: [],
  };
  session.slots.push(draft);
  function Slot() {
    return withAuthoringErrors(() => {
      const slotRegion = session.nextRegion();
      draft.regionIds.push(slotRegion);
      const capture = React.useContext(runtime.contexts.styles);
      const ownerPath =
        original.kind === "instance"
          ? session.instances.find(
              (instance) => instance.key === original.instanceKey,
            )?.componentPath
          : capture?.entryOwner;
      const supplied = capture?.wrap(ownerPath, node) ?? node;
      return React.createElement(
        React.Fragment,
        null,
        session.boundary(
          `mokly-slot:start id="${slotRegion}" instance="${region}" name="${name.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}"`,
        ),
        React.createElement(
          runtime.contexts.owner.Provider,
          { value: { ...original, seen: new Set<string>() } },
          supplied,
        ),
        session.boundary(`mokly-slot:end id="${slotRegion}"`),
      );
    });
  }
  const wrapped = React.createElement(Slot);
  slots.set(wrapped, { owner: original, key });
  return wrapped;
}
