/** A nested stand-in for the served shell markup the Browse client mutates,
 * shared by the client suites so one fake models the whole column: attribute
 * selectors, ancestor lookup, class state, and dispatched events. */

const SELECTOR = /^(?<tag>[a-z]*)\[(?<name>[a-z-]+)(?:="(?<value>[^"]*)")?\]$/;

/** The subset of `DOMTokenList` the client modules use. */
export class FakeClassList {
  readonly #tokens = new Set<string>();

  add(token: string): void {
    this.#tokens.add(token);
  }

  contains(token: string): boolean {
    return this.#tokens.has(token);
  }

  remove(token: string): void {
    this.#tokens.delete(token);
  }

  toggle(token: string, force?: boolean): boolean {
    const next = force ?? !this.#tokens.has(token);
    if (next) this.#tokens.add(token);
    else this.#tokens.delete(token);
    return next;
  }
}

/** One element of the fake shell tree. */
export class FakeNode {
  activeElement: FakeNode | null = null;
  readonly classList = new FakeClassList();
  readonly dataset: Record<string, string> = {};
  readonly dispatched: Event[] = [];
  hidden = false;
  onDispatch: ((event: Event) => void) | undefined;
  open = true;
  parentElement: FakeNode | null = null;
  scrolled = false;
  value = "";
  readonly #attributes: Map<string, string>;
  readonly #children: FakeNode[] = [];

  constructor(
    private readonly tagName: string,
    attributes: Readonly<Record<string, string>> = {},
    private label = "",
  ) {
    this.#attributes = new Map(Object.entries(attributes));
  }

  /** The tree root, which the client modules address as the document. */
  get ownerDocument(): FakeNode {
    return this.treeRoot();
  }

  get textContent(): string {
    return this.#children.reduce(
      (text, child) => text + child.textContent,
      this.label,
    );
  }

  set textContent(value: string) {
    this.#children.length = 0;
    this.label = value;
  }

  append(...children: readonly FakeNode[]): this {
    for (const child of children) {
      child.parentElement = this;
      this.#children.push(child);
    }
    return this;
  }

  closest(selector: string): FakeNode | null {
    if (this.matches(selector)) return this;
    return this.parentElement?.closest(selector) ?? null;
  }

  contains(other: FakeNode | null): boolean {
    for (let node = other; node; node = node.parentElement)
      if (node === this) return true;
    return false;
  }

  dispatchEvent(event: Event): boolean {
    this.dispatched.push(event);
    this.onDispatch?.(event);
    return true;
  }

  /** Record this node as the focused element on the tree root, as a document
   * records its `activeElement`. */
  focus(): void {
    this.treeRoot().activeElement = this;
  }

  hasAttribute(name: string): boolean {
    return this.#attributes.has(name);
  }

  getAttribute(name: string): string | null {
    return this.#attributes.get(name) ?? null;
  }

  getElementById(id: string): FakeNode | null {
    for (const child of this.#children) {
      if (child.getAttribute("id") === id) return child;
      const found = child.getElementById(id);
      if (found) return found;
    }
    return null;
  }

  matches(selector: string): boolean {
    const parts = SELECTOR.exec(selector)?.groups;
    if (!parts) throw new Error(`unmodelled selector: ${selector}`);
    const tag = parts["tag"] ?? "";
    const value = this.#attributes.get(parts["name"] ?? "");
    if (tag !== "" && tag !== this.tagName) return false;
    if (value === undefined) return false;
    return parts["value"] === undefined || parts["value"] === value;
  }

  querySelector(selector: string): FakeNode | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): FakeNode[] {
    return this.#children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }

  removeAttribute(name: string): void {
    this.#attributes.delete(name);
  }

  scrollIntoView(): void {
    this.scrolled = true;
  }

  setAttribute(name: string, value: string): void {
    this.#attributes.set(name, value);
  }

  /** The node the client modules view as the document. */
  treeRoot(): FakeNode {
    return this.parentElement?.treeRoot() ?? this;
  }
}

/** View one fake node as the document the client modules accept. */
export function asDocument(node: FakeNode): Document {
  return node as unknown as Document;
}

/** View one fake node as the catalogue row the navigation helpers return. */
export function asAnchor(node: FakeNode): HTMLAnchorElement {
  return node as unknown as HTMLAnchorElement;
}

/** View one fake node as the click target the delegated handlers receive. */
export function asElement(node: FakeNode): Element {
  return node as unknown as Element;
}
