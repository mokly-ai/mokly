/** One signal owner covers preparation, Serve samples and final restoration. */
import { stop } from "./process.mjs";

export class BenchmarkCancellation {
  #controller = new AbortController();
  #active;
  #interrupt = () => {
    this.#controller.abort();
    if (this.#active) void stop(this.#active).catch(() => {});
  };

  constructor() {
    process.on("SIGINT", this.#interrupt);
    process.on("SIGTERM", this.#interrupt);
  }

  get signal() {
    return this.#controller.signal;
  }

  setActive(running) {
    this.#active = running;
    if (this.signal.aborted) void stop(running).catch(() => {});
  }

  clearActive(running) {
    if (this.#active === running) this.#active = undefined;
  }

  dispose() {
    process.off("SIGINT", this.#interrupt);
    process.off("SIGTERM", this.#interrupt);
  }
}
