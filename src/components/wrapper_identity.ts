const wrappers = new WeakSet<object>();

/** Brand only wrappers created by defineComponent in this consumer graph. */
export function registerComponentWrapper(wrapper: object): void {
  wrappers.add(wrapper);
}

export function isComponentWrapper(type: unknown): boolean {
  return typeof type === "function" && wrappers.has(type);
}
