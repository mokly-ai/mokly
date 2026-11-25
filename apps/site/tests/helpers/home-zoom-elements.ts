/**
 * The elements of the stub home of `tests/helpers/home-zoom.ts`: an element
 * of the pill, which the island finds by the marks of `zoom-marks.ts`, an
 * inline style, and a part that the zoom scales.
 */

import { ZOOM_MARKS } from "../../src/components/home/zoom-marks.js";

/** Whether `attributes` hold the one mark that `selectors` names. */
export function marked(
  attributes: ReadonlyMap<string, string>,
  selectors: string,
): boolean {
  const [, name, value] = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(selectors) ?? [];
  if (name === undefined) throw new Error(`The stub has no ${selectors}`);
  const own = attributes.get(name);
  return own !== undefined && (value === undefined || own === value);
}

/** An element of the stub pill, with the attributes the island reads. */
export class StubElement {
  readonly attributes: Map<string, string>;
  readonly clicks: Array<() => void> = [];
  constructor(
    attributes: Readonly<Record<string, string>>,
    public textContent: string | null = null,
    readonly children: readonly StubElement[] = [],
    readonly top: () => number = () => 0,
  ) {
    this.attributes = new Map(Object.entries(attributes));
  }
  addEventListener(_type: "click", listener: () => void): void {
    this.clicks.push(listener);
  }
  getBoundingClientRect(): { readonly top: number } {
    return { top: this.top() };
  }
  querySelector(selectors: string): StubElement | null {
    return find(this.children, selectors);
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  toggleAttribute(name: string, force: boolean): boolean {
    if (force) this.attributes.set(name, "");
    else this.attributes.delete(name);
    return force;
  }
}

/** The first of `elements`, or of their children, that `selectors` names. */
export function find(
  elements: readonly StubElement[],
  selectors: string,
): StubElement | null {
  for (const element of elements) {
    if (marked(element.attributes, selectors)) return element;
    const inside = find(element.children, selectors);
    if (inside !== null) return inside;
  }
  return null;
}

/** An inline style, as the island sets it. */
export class StubStyle {
  readonly properties = new Map<string, string>();
  removeProperty(property: string): string {
    const value = this.properties.get(property) ?? "";
    this.properties.delete(property);
    return value;
  }
  setProperty(property: string, value: string): void {
    this.properties.set(property, value);
  }
}

/** A part that the zoom scales, with its own height in its layout. */
export class StubPart {
  readonly attributes = new Map(Object.entries(ZOOM_MARKS.part));
  readonly style = new StubStyle();
  constructor(public height: number) {}
  /** The height that the part takes in the page: its own and its margin. */
  taken(): number {
    const margin = this.style.properties.get("margin-bottom") ?? "0px";
    return this.height + Number.parseFloat(margin);
  }
}
