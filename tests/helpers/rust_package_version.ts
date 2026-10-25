/** Find independent Cargo versions and implicit clap version defaults. */
export function rustPackageVersionProblems(source: string): string[] {
  const problems: string[] = [];
  // This is a token policy, including comments and strings, not a macro parser.
  if (/\bCARGO_PKG_VERSION(?:_[A-Z0-9_]+)?\b/u.test(source))
    problems.push("Cargo version token");
  const code = withoutCommentsAndLiterals(source);
  for (const match of code.matchAll(/#\s*\[\s*(?:command|clap)\s*\(/gu)) {
    let depth = 1;
    let start = match.index + match[0].length;
    for (let index = start; index < code.length; index += 1) {
      const char = code[index]!;
      if (depth === 1 && (char === "," || char === ")")) {
        if (code.slice(start, index).trim().replace(/^r#/u, "") === "version")
          problems.push("implicit clap version");
        start = index + 1;
        if (char === ")") break;
      } else if ("([{".includes(char)) depth += 1;
      else if (")]}".includes(char)) depth -= 1;
    }
  }
  return problems;
}

function withoutCommentsAndLiterals(source: string): string {
  const code: string[] = [];
  let index = 0;
  while (index < source.length) {
    if (source.startsWith("//", index)) {
      const end = source.indexOf("\n", index);
      index = end < 0 ? source.length : end;
    } else if (source.startsWith("/*", index)) {
      let depth = 1;
      index += 2;
      while (index < source.length && depth > 0) {
        if (source.startsWith("/*", index)) {
          depth += 1;
          index += 2;
        } else if (source.startsWith("*/", index)) {
          depth -= 1;
          index += 2;
        } else index += 1;
      }
      code.push(" ");
    } else {
      const char = source[index];
      const raw =
        char === "r" || char === "b"
          ? /^(?:br|r)(#*)"/u.exec(source.slice(index))
          : null;
      const character =
        char === "'" || char === "b"
          ? /^(?:b)?'(?:\\(?:u\{[a-fA-F0-9_]+\}|x[a-fA-F0-9]{2}|.)|[^'\\])'/u.exec(
              source.slice(index),
            )
          : null;
      if (raw) {
        const ending = '"' + raw[1];
        const end = source.indexOf(ending, index + raw[0].length);
        index = end < 0 ? source.length : end + ending.length;
        code.push(" ");
      } else if (character) {
        index += character[0].length;
        code.push(" ");
      } else if (char === '"') {
        index += 1;
        while (index < source.length && source[index] !== '"')
          index += source[index] === "\\" ? 2 : 1;
        index += 1;
        code.push(" ");
      } else {
        code.push(source[index]!);
        index += 1;
      }
    }
  }
  return code.join("");
}
