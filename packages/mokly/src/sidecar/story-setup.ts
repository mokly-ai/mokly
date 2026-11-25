import type { Generation } from "./bundle.js";
import type { StoredStory } from "./story-reader.js";

interface ActiveSetup {
  generation: Generation;
  folder: string;
  cleanup: Awaited<ReturnType<StoredStory["beforeAll"]>>;
}

let activeSetup: ActiveSetup | undefined;
const failures = new WeakMap<Generation, Map<string, unknown>>();

export async function setupStories(
  generation: Generation,
  folder: string,
  beforeAll: StoredStory["beforeAll"],
): Promise<void> {
  const generationFailures = failures.get(generation);
  if (generationFailures?.has(folder)) throw generationFailures.get(folder);
  if (activeSetup?.generation === generation && activeSetup.folder === folder)
    return;

  const previous = activeSetup;
  activeSetup = undefined;
  await previous?.cleanup?.();

  try {
    const cleanup = await beforeAll();
    activeSetup = { generation, folder, cleanup };
  } catch (error) {
    if (generationFailures) generationFailures.set(folder, error);
    else failures.set(generation, new Map([[folder, error]]));
    throw error;
  }
}
