import type { ReactNode } from "react";

import { copyData, digest, reviewMaterialKey } from "./data.js";
import { validateDestination } from "./links.js";
import type { AuthoringRuntime, DefinitionData, Owner } from "./runtime.js";
import { wrapperBrand } from "./runtime.js";

const slots = new WeakSet<object>();

/** Render an adapter under instance ownership, while slots retain input ownership. */
export function componentWrapper(definition: object, data: DefinitionData) {
  const runtime = data.runtime;
  const React = runtime.react;
  function Component(input: Record<string, unknown>): ReactNode {
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
    const { moklyInstance, __moklySource: _source, ...supplied } = input;
    const id = moklyInstance ?? registered.path.split("/").at(-1)!;
    if (
      typeof id !== "string" ||
      (moklyInstance !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
    )
      throw new Error("moklyInstance must be lowercase kebab-case");
    if (parent.seen.has(id)) throw new Error(`duplicate instance ${id}`);
    parent.seen.add(id);
    const key = digest([
      "mokly-instance-v1",
      parent.kind,
      parent.instanceKey ?? null,
      parent.slotKey ?? null,
      id,
    ]);
    const region = session.nextRegion();
    const props: Record<string, unknown> = {};
    const slotProps: Record<string, ReactNode> = {};
    const names = (data.input.slots ?? []) as string[];
    for (const [name, value] of Object.entries(supplied)) {
      if (names.includes(name))
        slotProps[name] = wrapSlot(
          runtime,
          value as ReactNode,
          parent,
          key,
          region,
          name,
        );
      else props[name] = value;
    }
    const normalized = copyData(props) as Record<string, unknown>;
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
    const owner: Owner = {
      kind: "instance",
      instanceKey: key,
      seen: new Set(),
    };
    return React.createElement(
      React.Fragment,
      null,
      session.boundary(
        `mokly-instance:start id="${region}" path="${registered.path}" instance="${key}" props="${reviewMaterialKey(normalized)}"`,
      ),
      React.createElement(
        runtime.contexts.owner.Provider,
        { value: owner },
        React.createElement(Adapter),
      ),
      session.boundary(`mokly-instance:end id="${region}"`),
    );
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
  if (node && typeof node === "object" && slots.has(node)) return node;
  const React = runtime.react;
  const original: Owner = {
    ...parent,
    slotKey: parent.slotKey ?? digest(["mokly-slot-v1", instance, name]),
  };
  function Slot() {
    const session = runtime.session();
    return React.createElement(
      React.Fragment,
      null,
      session.boundary(`mokly-slot:start id="${region}" name="${name}"`),
      React.createElement(
        runtime.contexts.owner.Provider,
        { value: { ...original, seen: new Set<string>() } },
        node,
      ),
      session.boundary(`mokly-slot:end id="${region}"`),
    );
  }
  const wrapped = React.createElement(Slot);
  slots.add(wrapped);
  return wrapped;
}
