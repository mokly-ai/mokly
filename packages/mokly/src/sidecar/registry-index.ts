import postcss from "postcss";
import type { AtRule, ChildNode, Root, Rule } from "postcss";

import type { HtmlInput } from "./html_input.js";
import {
  classTokens,
  dependencyName,
  inKeyframes,
  isDependency,
  namesVariable,
  pruned,
  registryStyles,
  selectorClasses,
  valueWords,
} from "./registry-styles.js";

/**
 * The most registry texts that one index holds. The React Native Web sheet
 * only grows, so a generation never returns to an earlier text, and each
 * mokly-cloud sidecar filtered one text.
 */
export const REGISTRY_TEXT_LIMIT = 1;

/**
 * The most outputs that one indexed text holds. A warm mokly-cloud edit made
 * 44 filter calls in all, so the outputs of one edit stay, also when each call
 * needs other rules.
 */
export const REGISTRY_OUTPUT_LIMIT = 64;

/** The class names of one selector. */
type Selector = readonly string[];

/** One parsed registry text and the analysis that each call reads. */
interface IndexedText {
  /** The parsed text. It stays unchanged: each new output prunes a clone. */
  readonly root: Root;
  /** For each selector rule outside keyframes, in document order, its selectors. */
  readonly selectors: readonly (readonly Selector[])[];
  /** For each node, the selector rules and then the dependency rules, its child positions. */
  readonly paths: readonly (readonly number[])[];
  /** For each node, the dependency nodes that its declarations name. */
  readonly uses: readonly (readonly number[])[];
  /** The output for each set of needed nodes, the least recently used first. */
  readonly outputs: Map<string, string>;
}

/**
 * The registry index of each generation object. A weak key keeps no
 * generation alive, so an index ends with its generation: at `dispose`, at
 * `shutdown`, or when a `bundle` result replaces the generation.
 */
const indexes = new WeakMap<object, RegistryIndex>();

/** The registry index of a generation, created at its first filter. */
export function registryIndexOf(generation: object): RegistryIndex {
  let index = indexes.get(generation);
  if (!index) {
    index = new RegistryIndex();
    indexes.set(generation, index);
  }
  return index;
}

/** The registry texts that one generation filtered, each parsed once. */
export class RegistryIndex {
  private readonly held = new Map<string, IndexedText>();

  /** The held texts, the least recently used first, with their held outputs. */
  get texts(): ReadonlyMap<
    string,
    { readonly outputs: ReadonlyMap<string, string> }
  > {
    return this.held;
  }

  /** The same bytes as `registryStyles`, without a parse for a held text. */
  styles(css: string, input: HtmlInput): string {
    if (!css) return "";
    const text = this.indexed(css);
    if (!text) return registryStyles(css, input);
    const nodes = neededNodes(text, classTokens(input));
    const key = nodes.join(",");
    const output = text.outputs.get(key);
    if (output !== undefined) {
      renew(text.outputs, key, output);
      return output;
    }
    const printed = printNodes(text, nodes);
    if (printed === undefined) return registryStyles(css, input);
    hold(text.outputs, key, printed, REGISTRY_OUTPUT_LIMIT);
    return printed;
  }

  /**
   * The held index of the text, or a new one. None when the analysis throws,
   * such as for a text that does not parse: `registryStyles` then throws the
   * same error, or, when its walk stops before the throwing selector, it
   * gives its own output.
   */
  private indexed(css: string): IndexedText | undefined {
    const text = this.held.get(css);
    if (text) {
      renew(this.held, css, text);
      return text;
    }
    let created: IndexedText;
    try {
      created = indexText(css);
    } catch {
      return undefined;
    }
    hold(this.held, css, created, REGISTRY_TEXT_LIMIT);
    return created;
  }
}

/** A selector rule or a dependency rule, with every declaration value inside it. */
interface Owner<Node> {
  readonly node: Node;
  readonly path: readonly number[];
  readonly values: string[];
}

/** Parse the text once and record what `registryStyles` reads on each call. */
function indexText(css: string): IndexedText {
  const root = postcss.parse(css);
  const rules: Owner<Rule>[] = [];
  const dependencies: Owner<AtRule>[] = [];
  // Visit in document order, as the walks of `registryStyles` do. A PostCSS
  // walk would leave iterator records on each container, and each clone of
  // the held tree would copy them.
  const visit = (
    nodes: readonly ChildNode[],
    prefix: readonly number[],
    enclosing: readonly string[][],
  ) =>
    nodes.forEach((node, position) => {
      if (node.type === "decl")
        for (const values of enclosing) values.push(node.value);
      if (node.type === "decl" || node.type === "comment") return;
      const path = [...prefix, position];
      const values: string[] = [];
      let inner = enclosing;
      if (node.type === "rule" && !inKeyframes(node)) {
        rules.push({ node, path, values });
        inner = [...enclosing, values];
      } else if (node.type === "atrule" && isDependency(node)) {
        dependencies.push({ node, path, values });
        inner = [...enclosing, values];
      }
      if (node.nodes) visit(node.nodes, path, inner);
    });
  visit(root.nodes, [], []);
  const named = new Map<string, number[]>();
  dependencies.forEach(({ node }, item) => {
    const name = dependencyName(node);
    if (name)
      named.set(name, [...(named.get(name) ?? []), rules.length + item]);
  });
  const valueUses = new Map<string, readonly number[]>();
  const uses = (values: readonly string[]) => {
    const found = new Set<number>();
    for (const value of values) {
      let nodes = valueUses.get(value);
      if (!nodes) {
        nodes = namedNodes(value, named);
        valueUses.set(value, nodes);
      }
      for (const used of nodes) found.add(used);
    }
    return [...found];
  };
  const owners = [...rules, ...dependencies];
  return {
    root,
    selectors: rules.map(({ node }) => node.selectors.map(selectorClasses)),
    paths: owners.map(({ path }) => path),
    uses: owners.map(({ values }) => uses(values)),
    outputs: new Map(),
  };
}

/** The dependency nodes that a declaration value names, as `registryStyles` tests it. */
function namedNodes(
  value: string,
  named: ReadonlyMap<string, readonly number[]>,
): number[] {
  const found = new Set<number>();
  for (const word of valueWords(value))
    for (const node of named.get(word) ?? []) found.add(node);
  // `namesVariable` looks for `var(` and the name, so a value without it names none.
  if (value.includes("var("))
    for (const [name, nodes] of named)
      if (namesVariable(value, name)) for (const node of nodes) found.add(node);
  return [...found];
}

/** The matched selector rules and every dependency they name, in node order. */
function neededNodes(text: IndexedText, tokens: ReadonlySet<string>): number[] {
  const marked = new Uint8Array(text.paths.length);
  const pending: number[] = [];
  text.selectors.forEach((selectors, rule) => {
    if (selectors.some((names) => names.every((name) => tokens.has(name)))) {
      marked[rule] = 1;
      pending.push(rule);
    }
  });
  for (let node = pending.pop(); node !== undefined; node = pending.pop())
    for (const used of text.uses[node] ?? [])
      if (!marked[used]) {
        marked[used] = 1;
        pending.push(used);
      }
  const nodes: number[] = [];
  marked.forEach((flag, node) => {
    if (flag) nodes.push(node);
  });
  return nodes;
}

/** Prune a clone of the parsed text to the needed nodes, as `registryStyles` prunes. */
function printNodes(
  text: IndexedText,
  nodes: readonly number[],
): string | undefined {
  const root = text.root.clone();
  const needed = new Set<ChildNode>();
  for (const node of nodes) {
    const found = nodeAt(root, text.paths[node] ?? []);
    if (!found) return undefined;
    needed.add(found);
  }
  return pruned(root, needed);
}

/** The node at the child positions of `path` from the root, as in the parsed text. */
function nodeAt(root: Root, path: readonly number[]): ChildNode | undefined {
  let found: ChildNode | undefined;
  let nodes: ChildNode[] | undefined = root.nodes;
  for (const position of path) {
    found = nodes?.[position];
    nodes = found && "nodes" in found ? found.nodes : undefined;
  }
  return found;
}

/** Move a held entry to the newest place. */
function renew<Key, Value>(map: Map<Key, Value>, key: Key, value: Value): void {
  map.delete(key);
  map.set(key, value);
}

/** Add an entry; past the limit, the least recently used entries leave first. */
function hold<Key, Value>(
  map: Map<Key, Value>,
  key: Key,
  value: Value,
  limit: number,
): void {
  map.set(key, value);
  for (const oldest of map.keys()) {
    if (map.size <= limit) break;
    map.delete(oldest);
  }
}
