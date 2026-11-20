/**
 * What the running product announces a state with.
 *
 * The catalogue draws a state as an `fo-state-title`. In the product that
 * element is `StateMessage`, and a handful of components render it on a
 * caller's behalf: the caller writes the sentence and passes it down. Reading
 * those components by name, rather than every `title=` on the page, is what
 * keeps a section heading or a dialog's own name out of the comparison.
 *
 * The map below is a contract, not a convenience: `announcerViolations()`
 * checks it against the application on every run, so a component that starts
 * forwarding a title cannot appear unlisted and quietly hide the sentences its
 * callers write. Adding a wrapper without adding it here fails the suite.
 */

/** The component that actually puts a state title on screen. */
export const baseAnnouncer = "StateMessage";

/**
 * Every component that announces a state, and the prop its caller names the
 * sentence with. `StateMessage` is the base; the rest forward a caller's prop
 * into another announcer's title.
 */
export const announcers = {
  StateMessage: "title",
  PaneError: "title",
  PaneResource: "failure",
  StageError: "title",
} as const;

/** The props of one JSX element, from just after its name to its closing angle.
 *
 * Counting braces and stepping over quoted text is what makes this exact: a
 * prop holding another element — `action={<Action ... />}` — contains angles of
 * its own, and stopping at the first one would read half an element's props and
 * call it the whole.
 */
export function elementProps(source: string, from: number): string {
  let depth = 0;
  for (let at = from; at < source.length; at += 1) {
    const character = source[at];
    if (character === '"' || character === "'" || character === "`") {
      at += 1;
      while (at < source.length && source[at] !== character) {
        if (source[at] === "\\") at += 1;
        at += 1;
      }
      continue;
    }
    if (character === "{") depth += 1;
    else if (character === "}") depth -= 1;
    else if (character === ">" && depth === 0) return source.slice(from, at);
  }
  return source.slice(from);
}

/** The braced value of one prop, without its braces, or nothing if unbraced. */
export function bracedValue(props: string, prop: string): string | undefined {
  const at = new RegExp("\\b" + prop + "=\\{").exec(props);
  if (!at) return undefined;
  let depth = 0;
  for (let cursor = at.index + at[0].length - 1; cursor < props.length;) {
    const character = props[cursor];
    if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0)
        return props.slice(at.index + at[0].length, cursor).trim();
    }
    cursor += 1;
  }
  return undefined;
}

/** Every announcer element in one source, with the props it was given. */
function announcements(source: string): { element: string; props: string }[] {
  const found: { element: string; props: string }[] = [];
  for (const element of Object.keys(announcers)) {
    const opens = new RegExp("<" + element + "\\b", "g");
    for (let at = opens.exec(source); at; at = opens.exec(source))
      found.push({
        element,
        props: elementProps(source, at.index + at[0].length),
      });
  }
  return found;
}

/**
 * Every state title one application source writes as a literal.
 *
 * A sentence chosen in place — `title={named ? "…" : "…"}` — is still written
 * by this file, and both branches are states it can announce, so every literal
 * inside the expression counts. A title the source only passes on, or asks
 * another function for, is not a sentence this file decides, and is left to the
 * file that does decide it.
 */
export function stateTitlesWritten(source: string): string[] {
  const found: string[] = [];
  for (const { element, props } of announcements(source)) {
    const prop = announcers[element as keyof typeof announcers];
    const literal = new RegExp("\\b" + prop + '="([^"]*)"').exec(props);
    if (literal) {
      found.push(literal[1]);
      continue;
    }
    const braced = bracedValue(props, prop);
    if (braced)
      for (const inside of braced.matchAll(/"([^"]*)"/g)) {
        // A literal the expression compares against chooses the sentence; it
        // is not one. `reason === "operation-unavailable" ? … : …` names a
        // reason, and only the two branches after it are states.
        if (/(?:[=!]==?)\s*$/.test(braced.slice(0, inside.index))) continue;
        found.push(inside[1]);
      }
  }
  return [...new Set(found)];
}

/** The top-level declaration a position in one source sits inside. */
function enclosing(source: string, at: number): string | undefined {
  const declarations = /^(?:export )?(?:function|const) ([A-Za-z0-9_]+)/gm;
  let name: string | undefined;
  for (
    let hit = declarations.exec(source);
    hit;
    hit = declarations.exec(source)
  ) {
    if (hit.index > at) break;
    name = hit[1];
  }
  return name;
}

/** One component that passes its caller's sentence into another announcer. */
export interface Forwarder {
  component: string;
  prop: string;
}

/**
 * Every component in one source that forwards a prop straight into an
 * announcer's title. Such a component announces nothing of its own: the
 * sentence belongs to whoever calls it, so the map has to know the name it is
 * called by and the prop that name takes.
 */
export function forwardingAnnouncers(source: string): Forwarder[] {
  const found: Forwarder[] = [];
  for (const element of Object.keys(announcers)) {
    const opens = new RegExp("<" + element + "\\b", "g");
    for (let at = opens.exec(source); at; at = opens.exec(source)) {
      const props = elementProps(source, at.index + at[0].length);
      const braced = bracedValue(
        props,
        announcers[element as keyof typeof announcers],
      );
      if (!braced || !/^[A-Za-z0-9_]+$/.test(braced)) continue;
      const component = enclosing(source, at.index);
      if (component) found.push({ component, prop: braced });
    }
  }
  return found;
}
