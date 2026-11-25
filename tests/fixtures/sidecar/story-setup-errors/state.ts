export const events: string[] = [];

export function setup(name: string, failure?: string) {
  events.push(`setup:${name}`);
  return async () => {
    await Promise.resolve();
    events.push(`cleanup:${name}`);
    if (failure) throw new Error(failure);
  };
}
