import type { ComponentInstanceRecord } from "@mokly/viewer";

/** Input structure is explicit so new inspection metadata cannot become Changes evidence. */
export function instanceStructure(instance: ComponentInstanceRecord) {
  return {
    key: instance.key,
    id: instance.id,
    componentId: instance.componentId,
    owner: instance.owner,
    ...(instance.slotKey !== undefined ? { slotKey: instance.slotKey } : {}),
    order: instance.order,
  };
}

/** Compare all logical inputs during slot replay, excluding invocation metadata. */
export function instanceInputs(instance: ComponentInstanceRecord) {
  return {
    ...instanceStructure(instance),
    props: instance.props,
    propsKey: instance.propsKey,
  };
}
