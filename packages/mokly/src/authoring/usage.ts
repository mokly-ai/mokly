import path from "node:path";

import type { ReactNode } from "react";

import type { InputOwner } from "../generated/sidecar/InputOwner.js";
import type { InstanceDraft } from "../generated/sidecar/InstanceDraft.js";
import type { InvocationSource } from "../generated/sidecar/InvocationSource.js";

import { digest, encodeData, reviewMaterialKey } from "./data.js";
import type {
  AuthoringRuntime,
  Owner,
  RenderSession,
  StyleCapture,
} from "./runtime.js";

export function inputOwner(owner: Owner): InputOwner {
  return owner.kind === "entry"
    ? { kind: "entry" }
    : { kind: "instance", instanceKey: owner.instanceKey! };
}

export function instancePlacement(
  session: RenderSession,
  parent: Owner,
  id: string,
) {
  parent.seen.add(id);
  const scope = [
    parent.kind,
    parent.instanceKey ?? null,
    parent.slotKey ?? null,
  ];
  const scopeKey = JSON.stringify(scope);
  let orders = session.inputOrders.get(scopeKey);
  if (!orders) {
    orders = new Map();
    session.inputOrders.set(scopeKey, orders);
  }
  const order = orders.get(id) ?? orders.size;
  orders.set(id, order);
  return {
    regionId: session.nextRegion(),
    key: digest(["mokly-instance-v1", ...scope, id]),
    id,
    owner: inputOwner(parent),
    ...(parent.slotKey ? { slotKey: parent.slotKey } : {}),
    order,
  };
}

export function instanceProps(props: Record<string, unknown>) {
  return {
    props: Object.fromEntries(
      Object.entries(props).map(([name, value]) => [name, encodeData(value)]),
    ),
    propsKey: reviewMaterialKey(props),
  };
}

export function renderInstance(
  runtime: AuthoringRuntime,
  session: RenderSession,
  draft: InstanceDraft,
  output: ReactNode,
  capture: StyleCapture | null,
): ReactNode {
  session.instances.push(draft);
  const { key, regionId, componentPath, propsKey } = draft;
  const React = runtime.react;
  const owner: Owner = { kind: "instance", instanceKey: key, seen: new Set() };
  const owned = capture?.wrap(componentPath, output) ?? output;
  return React.createElement(
    React.Fragment,
    null,
    session.boundary(
      `mokly-instance:start id="${regionId}" path="${componentPath}" instance="${key}" props="${propsKey}"`,
    ),
    React.createElement(
      runtime.contexts.owner.Provider,
      { value: owner },
      owned,
    ),
    session.boundary(`mokly-instance:end id="${regionId}"`),
  );
}

/** Invocation metadata is secondary and must never expose an absolute path. */
export function invocationSource(
  value: unknown,
  root: string,
  dependencies: readonly string[] = [],
): InvocationSource | undefined {
  if (value === undefined) return;
  if (!value || typeof value !== "object")
    throw new Error("invalid invocation source");
  const { fileName, lineNumber, columnNumber } = value as Record<
    string,
    unknown
  >;
  if (
    typeof fileName !== "string" ||
    !Number.isSafeInteger(lineNumber) ||
    !Number.isSafeInteger(columnNumber) ||
    Number(lineNumber) < 1 ||
    Number(columnNumber) < 1
  )
    throw new Error("invalid invocation source");
  const absolute = path.resolve(root, fileName);
  if (
    dependencies.some((directory) => {
      const relative = path.relative(directory, absolute);
      return (
        relative !== ".." &&
        !relative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relative)
      );
    })
  )
    return;
  const relative = path.relative(root, absolute).split(path.sep).join("/");
  if (
    !relative ||
    relative
      .split("/")
      .some((segment) => !segment || segment === "." || segment === "..") ||
    relative.includes("\\") ||
    relative.includes(":") ||
    relative.includes("\0")
  )
    throw new Error("invocation source is outside sourceRoot");
  if (relative.split("/").includes("node_modules")) return;
  return {
    path: relative,
    line: Number(lineNumber),
    column: Number(columnNumber),
  };
}
