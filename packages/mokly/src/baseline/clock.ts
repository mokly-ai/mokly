import { setTimeout } from "node:timers/promises";

import type { BaselineClock } from "./types.js";

/** Operating-system time; lock waits wake immediately on cancellation. */
export class SystemBaselineClock implements BaselineClock {
  now(): number {
    return Date.now();
  }
  async sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
    await setTimeout(milliseconds, undefined, signal ? { signal } : {});
  }
}
