export interface SpecifierTrie {
  terminal: boolean;
  children: Map<string, SpecifierTrie>;
}

interface Prepared {
  id: number;
  terminal: boolean;
  bytes: number;
  different: string;
  differentBytes: number;
  children: Array<[string, Prepared]>;
  groups: Array<{ prefix: string; child: Prepared }>;
}
interface Character {
  key: string;
  literal: string;
  inClass: string;
  literalBytes: number;
  classBytes: number;
}
const rest = "[\\s\\S]";
const wrapperBytes = 5;
const literal = (character: string) =>
  "\\^$.*+?()[]{}|/".includes(character) ? "\\" + character : character;
const classCharacter = (character: string) =>
  "\\][^-/".includes(character) ? "\\" + character : character;

function prepare(root: SpecifierTrie, byteLimit: number): Prepared {
  const interned = new Map<string, Prepared>();
  const characters = new Map<string, Character>();
  const info = (character: string): Character => {
    const cached = characters.get(character);
    if (cached) return cached;
    const escaped = literal(character);
    const inClass = classCharacter(character);
    const value = {
      key: String(character.codePointAt(0)) + ":",
      literal: escaped,
      inClass,
      literalBytes: Buffer.byteLength(escaped),
      classBytes: Buffer.byteLength(inClass),
    };
    characters.set(character, value);
    return value;
  };
  const leaf = (terminal: boolean, id: number): Prepared => ({
    id,
    terminal,
    bytes: rest.length + 1,
    different: "",
    differentBytes: 0,
    children: [],
    groups: [],
  });
  const leaves = [leaf(false, 0), leaf(true, 1)];
  let nextId = 2;
  const visit = (node: SpecifierTrie): Prepared => {
    if (node.children.size === 0) return leaves[node.terminal ? 1 : 0]!;
    if (node.children.size === 1) {
      const [character, input] = node.children.entries().next().value!;
      const child = visit(input);
      const value = info(character);
      const key = (node.terminal ? "1:" : "0:") + value.key + child.id + ";";
      const cached = interned.get(key);
      if (cached) return cached;
      const different = `[^${value.inClass}]${rest}*`;
      const differentBytes = 4 + rest.length + value.classBytes;
      const prepared: Prepared = {
        id: nextId++,
        terminal: node.terminal,
        bytes: Math.min(
          5 +
            differentBytes +
            value.literalBytes +
            child.bytes +
            (node.terminal ? 0 : 2),
          byteLimit + 1,
        ),
        different,
        differentBytes,
        children: [[character, child]],
        groups: [{ prefix: value.literal, child }],
      };
      interned.set(key, prepared);
      return prepared;
    }
    const children: Array<[string, Prepared]> = [];
    let key = node.terminal ? "1:" : "0:";
    for (const [character, child] of [...node.children].sort(
      ([left], [right]) => (left < right ? -1 : left > right ? 1 : 0),
    )) {
      const prepared = visit(child);
      children.push([character, prepared]);
      key += info(character).key + prepared.id + ";";
    }
    const cached = interned.get(key);
    if (cached) return cached;
    const bySuffix = new Map<
      number,
      { characters: Character[]; child: Prepared }
    >();
    const differentCharacters: string[] = [];
    let differentBytes = 4 + rest.length;
    for (const [character, child] of children) {
      const value = info(character);
      differentCharacters.push(value.inClass);
      differentBytes += value.classBytes;
      const group = bySuffix.get(child.id);
      if (group) group.characters.push(value);
      else bySuffix.set(child.id, { characters: [value], child });
    }
    const groups: Prepared["groups"] = [];
    let bytes = 4 + differentBytes + (node.terminal ? 0 : 2);
    for (const group of bySuffix.values()) {
      const first = group.characters[0]!;
      const prefix =
        group.characters.length === 1
          ? first.literal
          : `[${group.characters.map((value) => value.inClass).join("")}]`;
      const prefixBytes =
        group.characters.length === 1
          ? first.literalBytes
          : 2 +
            group.characters.reduce((sum, value) => sum + value.classBytes, 0);
      bytes += 1 + prefixBytes + group.child.bytes;
      groups.push({ prefix, child: group.child });
    }
    const prepared: Prepared = {
      id: nextId++,
      terminal: node.terminal,
      bytes: Math.min(bytes, byteLimit + 1),
      different: `[^${differentCharacters.join("")}]${rest}*`,
      differentBytes,
      children,
      groups,
    };
    interned.set(key, prepared);
    return prepared;
  };
  return visit(root);
}

function render(node: Prepared): string {
  const chunks: string[] = [];
  const visit = (value: Prepared): void => {
    if (!value.children.length) {
      chunks.push(rest, value.terminal ? "+" : "*");
      return;
    }
    chunks.push("(?:");
    if (!value.terminal) chunks.push("$|");
    chunks.push(value.different);
    for (const group of value.groups) {
      chunks.push("|", group.prefix);
      visit(group.child);
    }
    chunks.push(")");
  };
  visit(node);
  return chunks.join("");
}

export function specifierPatterns(
  root: SpecifierTrie,
  byteLimit = 32768,
  totalLimit = 1048576,
): RegExp[] | undefined {
  const prepared = prepare(root, byteLimit);
  const pieces: Array<{ source: string; bytes: number }> = [];
  let pieceBytes = 0;
  const append = (source: string, bytes: number): boolean => {
    if (bytes + wrapperBytes > byteLimit) return false;
    pieceBytes += bytes;
    if (pieceBytes > totalLimit) return false;
    pieces.push({ source, bytes });
    return true;
  };
  const visit = (node: Prepared, stem: string, stemBytes: number): boolean => {
    if (node.bytes <= byteLimit - stemBytes - wrapperBytes)
      return append(stem + render(node), stemBytes + node.bytes);
    if (!node.terminal && !append(stem + "$", stemBytes + 1)) return false;
    if (!append(stem + node.different, stemBytes + node.differentBytes))
      return false;
    for (const [character, child] of node.children) {
      const escaped = literal(character);
      if (!visit(child, stem + escaped, stemBytes + Buffer.byteLength(escaped)))
        return false;
    }
    return true;
  };
  if (!visit(prepared, "", 0)) return undefined;
  const filters: RegExp[] = [];
  let group: string[] = [],
    bytes = wrapperBytes,
    total = 0;
  const flush = (): boolean => {
    const filter = new RegExp(`^(?:${group.join("|")})`);
    const actualBytes = Buffer.byteLength(filter.source);
    if (actualBytes !== bytes || actualBytes > byteLimit) return false;
    total += actualBytes;
    if (total > totalLimit) return false;
    filters.push(filter);
    group = [];
    bytes = wrapperBytes;
    return true;
  };
  for (const piece of pieces) {
    const cost = piece.bytes + (group.length ? 1 : 0);
    if (group.length && bytes + cost > byteLimit && !flush()) return undefined;
    bytes += piece.bytes + (group.length ? 1 : 0);
    group.push(piece.source);
  }
  return flush() ? filters : undefined;
}
