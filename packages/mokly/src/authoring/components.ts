import type { ReactNode } from "react";

import { validatePropSchema, validateProps } from "@mokly/viewer/data";

import type { InstanceDraft } from "../generated/sidecar/InstanceDraft.js";
import type { SlotDraft } from "../generated/sidecar/SlotDraft.js";

import { copyData, digest, encodeData, reviewMaterialKey } from "./data.js";
import { validateDestination } from "./links.js";
import type { AuthoringRuntime, DefinitionData, Owner } from "./runtime.js";
import { wrapperBrand } from "./runtime.js";
import { inputOwner, invocationSource } from "./usage.js";

const slots = new WeakMap<object, { owner: Owner; key: string }>();

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
    const { moklyInstance, __moklySource, ...supplied } = input;
    const id = moklyInstance ?? registered.path.split("/").at(-1)!;
    if (
      typeof id !== "string" ||
      (moklyInstance !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
    )
      throw new Error("moklyInstance must be lowercase kebab-case");
    if (parent.seen.has(id)) throw new Error(`duplicate instance ${id}`);
    parent.seen.add(id);
    const scope = JSON.stringify([
      parent.kind,
      parent.instanceKey ?? null,
      parent.slotKey ?? null,
    ]);
    let orders = session.inputOrders.get(scope);
    if (!orders) {
      orders = new Map();
      session.inputOrders.set(scope, orders);
    }
    const order = orders.get(id) ?? orders.size;
    orders.set(id, order);
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
    const schema = data.input.propSchema;
    validatePropSchema(schema, registered.path);
    validateProps(schema, normalized, registered.path);
    const source = invocationSource(
      __moklySource,
      session.sourceRoot,
      session.dependencyRoots,
    );
    session.instances.push({
      regionId: region,
      key,
      id,
      componentPath: registered.path,
      owner: inputOwner(parent),
      ...(parent.slotKey ? { slotKey: parent.slotKey } : {}),
      order,
      props: Object.fromEntries(
        Object.entries(normalized).map(([name, value]) => [
          name,
          encodeData(value),
        ]),
      ) as InstanceDraft["props"],
      propsKey: reviewMaterialKey(normalized),
      ...(source ? { source } : {}),
    });
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
    const slotRegion = session.nextRegion();
    draft.regionIds.push(slotRegion);
    return React.createElement(
      React.Fragment,
      null,
      session.boundary(
        `mokly-slot:start id="${slotRegion}" instance="${region}" name="${name.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}"`,
      ),
      React.createElement(
        runtime.contexts.owner.Provider,
        { value: { ...original, seen: new Set<string>() } },
        node,
      ),
      session.boundary(`mokly-slot:end id="${slotRegion}"`),
    );
  }
  const wrapped = React.createElement(Slot);
  slots.set(wrapped, { owner: original, key });
  return wrapped;
}
