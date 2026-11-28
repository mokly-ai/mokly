import { elementText, type IsElement } from "./story-prop-values.js";
import type { Element } from "./story-use-invocation.js";

interface Position {
  name: string;
  parent?: Position;
}

interface Member {
  name: string;
  value: unknown;
  child?: Container;
  mapped?: Projection;
}

interface Projection {
  output: unknown;
  data: unknown;
}

type Shape =
  | { kind: "object"; prototype: object | null }
  | { kind: "array" }
  | { kind: "map"; entries: [Member, Member][] }
  | { kind: "set"; entries: Member[] };

interface Container {
  original: object;
  position?: Position;
  shape: Shape;
  parents: Set<Container>;
  properties: [PropertyKey, PropertyDescriptor, Member?][];
  members: Member[];
  copies?: { output: object; data: object };
}

function shape(value: object, prototype: object | null): Shape | undefined {
  if (Array.isArray(value)) return { kind: "array" };
  if (prototype === Object.prototype || prototype === null)
    return { kind: "object", prototype };
  if (prototype === Map.prototype)
    return {
      kind: "map",
      entries: [...Map.prototype.entries.call(value)].map(
        ([key, value], index) => [
          { name: `${index}-key`, value: key },
          { name: `${index}-value`, value },
        ],
      ),
    };
  if (prototype === Set.prototype)
    return {
      kind: "set",
      entries: [...Set.prototype.values.call(value)].map((value, index) => ({
        name: String(index),
        value,
      })),
    };
}

function inspect(value: unknown, position?: Position): Container | undefined {
  if (!value || typeof value !== "object") return;
  try {
    const prototype: object | null = Object.getPrototypeOf(value);
    const selected = shape(value, prototype);
    if (!selected) return;
    const members: Member[] = [];
    if (selected.kind === "map")
      for (const [key, value] of selected.entries) members.push(key, value);
    if (selected.kind === "set")
      for (const value of selected.entries) members.push(value);
    const properties: Container["properties"] = [];
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor) continue;
      if (descriptor.enumerable && "value" in descriptor) {
        const name = typeof key === "symbol" ? String(key) : key;
        const member = { name, value: descriptor.value };
        members.push(member);
        properties.push([key, descriptor, member]);
      } else properties.push([key, descriptor]);
    }
    return {
      original: value,
      ...(position ? { position } : {}),
      shape: selected,
      parents: new Set(),
      members,
      properties,
    };
  } catch {
    // Leave opaque values to the prop digest reader.
    return;
  }
}

function copy(shape: Shape): object {
  switch (shape.kind) {
    case "object":
      return Object.create(shape.prototype);
    case "array":
      return [];
    case "map":
      return new Map<unknown, unknown>();
    case "set":
      return new Set<unknown>();
  }
}

function positionName(position: Position): string {
  const names: string[] = [];
  for (
    let current: Position | undefined = position;
    current;
    current = current.parent
  )
    names.push(current.name);
  return names.reverse().join("-");
}

function writeCopy(
  node: Container,
  target: object,
  field: "output" | "data",
): void {
  const read = (member: Member): unknown =>
    member.mapped
      ? member.mapped[field]
      : (member.child?.copies?.[field] ?? member.value);
  if (target instanceof Map && node.shape.kind === "map") {
    for (const [key, value] of node.shape.entries)
      target.set(field === "data" && key.mapped ? {} : read(key), read(value));
  }
  if (target instanceof Set && node.shape.kind === "set")
    for (const member of node.shape.entries)
      target.add(field === "data" && member.mapped ? {} : read(member));
  for (const [key, descriptor, member] of node.properties)
    Object.defineProperty(
      target,
      key,
      member ? { ...descriptor, value: read(member) } : descriptor,
    );
}

/** Project element leaves without copying unchanged values or recursing into cycles. */
export function projectStoryContent(
  value: unknown,
  isElement: IsElement,
  element: (node: Element, position: string) => Element,
): Projection | undefined {
  const project = (
    value: unknown,
    position: string,
  ): Projection | undefined => {
    if (value && typeof value === "object" && elementText(value, isElement))
      return { output: element(value as Element, position), data: undefined };
  };
  const direct = project(value, "0");
  if (direct) return direct;
  const root = inspect(value);
  if (!root) return;
  const nodes = new Map([[root.original, root]]);
  const dirty = new Set<Container>();
  const pending = [{ node: root, index: 0 }];
  while (pending.length) {
    const frame = pending.at(-1)!;
    const member = frame.node.members[frame.index++];
    if (!member) {
      pending.pop();
      continue;
    }
    const node = frame.node;
    const position = {
      name: member.name,
      ...(node.position ? { parent: node.position } : {}),
    };
    if (
      member.value &&
      typeof member.value === "object" &&
      elementText(member.value, isElement)
    ) {
      member.mapped = {
        output: element(member.value as Element, positionName(position)),
        data: undefined,
      };
      dirty.add(node);
    } else if (member.value && typeof member.value === "object") {
      let child = nodes.get(member.value);
      if (!child) {
        child = inspect(member.value, position);
        if (!child) continue;
        nodes.set(child.original, child);
        pending.push({ node: child, index: 0 });
      }
      member.child = child;
      child.parents.add(node);
    }
  }
  for (const node of dirty) {
    node.copies = { output: copy(node.shape), data: copy(node.shape) };
    for (const parent of node.parents) dirty.add(parent);
  }
  for (const node of dirty) {
    writeCopy(node, node.copies!.output, "output");
    writeCopy(node, node.copies!.data, "data");
  }
  return root.copies;
}
