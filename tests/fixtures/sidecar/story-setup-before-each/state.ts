let state = "unset";
const events: string[] = [];

export function setup(name: string) {
  return async () => {
    await Promise.resolve();
    const previous = state;
    state = name;
    events.push(`setup:${name}`);
    return async () => {
      await Promise.resolve();
      state = previous;
      events.push(`cleanup:${name}`);
    };
  };
}

export function load() {
  events.push(`load:${state}`);
  return {};
}

export function trace(): string {
  return `${state}|${events.join(",")}`;
}
