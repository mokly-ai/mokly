export interface SpecifierTrie {
  terminal: boolean;
  children: Map<string, SpecifierTrie>;
}

const rest = "[\\s\\S]";
const wrapperBytes = 5;

function literal(character: string): string {
  return "\\^$.*+?()[]{}|/".includes(character) ? "\\" + character : character;
}

function classCharacter(character: string): string {
  return ["\\", "]", "[", "^", "-", "/"].includes(character)
    ? "\\" + character
    : character;
}

function prefix(characters: string[]): string {
  return characters.length === 1
    ? literal(characters[0]!)
    : `[${characters.map(classCharacter).join("")}]`;
}

function mismatch(node: SpecifierTrie, limit: number): string | undefined {
  const characters: string[] = [];
  let bytes = 4 + rest.length;
  for (const character of node.children.keys()) {
    const escaped = classCharacter(character);
    bytes += Buffer.byteLength(escaped);
    if (bytes > limit) return undefined;
    characters.push(escaped);
  }
  return `[^${characters.join("")}]${rest}*`;
}

/** Stop building a subtree as soon as its complement cannot fit one pattern. */
function complement(node: SpecifierTrie, limit: number): string | undefined {
  if (!node.children.size) {
    const result = rest + (node.terminal ? "+" : "*");
    return result.length <= limit ? result : undefined;
  }
  const alternatives = node.terminal ? [] : ["$"];
  const different = mismatch(node, limit - 4 - (node.terminal ? 0 : 2));
  if (different === undefined) return undefined;
  alternatives.push(different);
  let bytes =
    4 +
    alternatives.reduce((sum, item) => sum + Buffer.byteLength(item), 0) +
    alternatives.length -
    1;
  if (bytes > limit) return undefined;
  const groups = new Map<string, string[]>();
  for (const [character, child] of node.children) {
    const suffix = complement(child, limit);
    if (suffix === undefined) return undefined;
    const characters = groups.get(suffix);
    if (characters) {
      bytes +=
        characters.length === 1
          ? Buffer.byteLength(
              `[${classCharacter(characters[0]!)}${classCharacter(character)}]`,
            ) - Buffer.byteLength(literal(characters[0]!))
          : Buffer.byteLength(classCharacter(character));
      characters.push(character);
    } else {
      bytes += 1 + Buffer.byteLength(literal(character) + suffix);
      groups.set(suffix, [character]);
    }
    if (bytes > limit) return undefined;
  }
  for (const [suffix, characters] of groups)
    alternatives.push(prefix(characters) + suffix);
  return `(?:${alternatives.join("|")})`;
}

/** Emit disjoint terminal, mismatch, and child branches without a full source. */
export function specifierPatterns(
  root: SpecifierTrie,
  byteLimit: number,
  totalLimit: number,
): RegExp[] | undefined {
  const pieces: string[] = [];
  let pieceBytes = 0;
  const append = (piece: string): boolean => {
    const bytes = Buffer.byteLength(piece);
    if (bytes + wrapperBytes > byteLimit) return false;
    pieceBytes += bytes;
    if (pieceBytes > totalLimit) return false;
    pieces.push(piece);
    return true;
  };
  const visit = (node: SpecifierTrie, stem: string): boolean => {
    const suffix = complement(
      node,
      byteLimit - Buffer.byteLength(stem) - wrapperBytes,
    );
    if (suffix !== undefined) return append(stem + suffix);
    if (!node.terminal && !append(stem + "$")) return false;
    const different = mismatch(
      node,
      byteLimit - Buffer.byteLength(stem) - wrapperBytes,
    );
    if (different === undefined || !append(stem + different)) return false;
    for (const [character, child] of node.children)
      if (!visit(child, stem + literal(character))) return false;
    return true;
  };
  if (!visit(root, "")) return undefined;
  const filters: RegExp[] = [];
  let group: string[] = [],
    bytes = wrapperBytes,
    total = 0;
  const flush = (): boolean => {
    total += bytes;
    if (total > totalLimit) return false;
    filters.push(new RegExp(`^(?:${group.join("|")})`));
    group = [];
    bytes = wrapperBytes;
    return true;
  };
  for (const piece of pieces) {
    const cost = Buffer.byteLength(piece) + (group.length ? 1 : 0);
    if (group.length && bytes + cost > byteLimit && !flush()) return undefined;
    bytes += Buffer.byteLength(piece) + (group.length ? 1 : 0);
    group.push(piece);
  }
  return flush() ? filters : undefined;
}
