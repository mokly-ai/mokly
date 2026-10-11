/** Authored-file read authority for one running catalogue server. */
import { GENERATED_DIRECTORY, isSafeRepositoryPath } from "@mokly/viewer/data";

/** Accept an IPC list only when it names safe authored paths outside generated output. */
export function isAuthoredClosure(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (route: unknown) =>
        typeof route === "string" &&
        isSafeRepositoryPath(route) &&
        !route.startsWith(`${GENERATED_DIRECTORY}/`),
    )
  );
}

/**
 * Serve the last checked closure plus on-demand additions from the current
 * source generation. Only a checked result replaces the checked closure.
 */
export class ServedClosure {
  #checked: ReadonlySet<string>;
  readonly #visited = new Set<string>();
  #current: ReadonlySet<string>;

  constructor(checked: readonly string[] = []) {
    this.#checked = new Set(checked);
    this.#current = this.#checked;
  }

  /** Paths that `/static/` may read before its read-time policy checks. */
  get current(): ReadonlySet<string> {
    return this.#current;
  }

  /** Replace the checked closure with a successful checked result. */
  accept(checked: readonly string[]): void {
    this.#checked = new Set(checked);
    this.#refresh();
  }

  /** Add one on-demand document's closure to the current generation. */
  visit(closure: readonly string[]): void {
    for (const route of closure) this.#visited.add(route);
    this.#refresh();
  }

  /**
   * Adopt a new source generation. Earlier on-demand additions end with their
   * generation; the checked closure stays until a checked result replaces it.
   */
  advance(checked?: readonly string[]): void {
    this.#visited.clear();
    if (checked) this.#checked = new Set(checked);
    this.#refresh();
  }

  #refresh(): void {
    this.#current = this.#visited.size
      ? new Set([...this.#checked, ...this.#visited])
      : this.#checked;
  }
}
