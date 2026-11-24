import type { Generation } from "./bundle.js";
import type { StoredStory } from "./story-reader.js";

interface ActiveSetup {
  generation: Generation;
  cleanup: Awaited<ReturnType<StoredStory["beforeAll"]>>;
}

let activeSetup: ActiveSetup | undefined;
const failures = new WeakMap<Generation, unknown>();

export async function setupStories(
  generation: Generation,
  beforeAll: StoredStory["beforeAll"],
): Promise<void> {
  if (failures.has(generation)) throw failures.get(generation);
  if (activeSetup?.generation === generation) return;

  const previous = activeSetup;
  activeSetup = undefined;
  await previous?.cleanup?.();

  try {
    const cleanup = await beforeAll();
    activeSetup = { generation, cleanup };
  } catch (error) {
    failures.set(generation, error);
    throw error;
  }
}
