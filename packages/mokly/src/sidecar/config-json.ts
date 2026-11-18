export function jsonObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Parse the JSON comments and trailing commas accepted in TypeScript configurations. */
export function parseJson(text: string): unknown {
  let cleaned = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (quoted) {
      cleaned += character;
      if (character === "\\") cleaned += text[++index] ?? "";
      else if (character === '"') quoted = false;
    } else if (character === '"') {
      quoted = true;
      cleaned += character;
    } else if (character === "/" && text[index + 1] === "/") {
      while (index < text.length && text[index] !== "\n") index++;
      cleaned += "\n";
    } else if (character === "/" && text[index + 1] === "*") {
      index += 2;
      while (
        index < text.length &&
        !(text[index] === "*" && text[index + 1] === "/")
      )
        index++;
      if (index >= text.length)
        throw new Error("unterminated configuration comment");
      index++;
      cleaned += " ";
    } else cleaned += character;
  }
  quoted = false;
  let result = "";
  for (let index = 0; index < cleaned.length; index++) {
    const character = cleaned[index]!;
    if (quoted) {
      result += character;
      if (character === "\\") result += cleaned[++index] ?? "";
      else if (character === '"') quoted = false;
    } else if (character === '"') {
      quoted = true;
      result += character;
    } else {
      let next = index + 1;
      if (character === ",")
        while (next < cleaned.length && /\s/.test(cleaned[next]!)) next++;
      if (character !== "," || !["}", "]"].includes(cleaned[next] ?? ""))
        result += character;
    }
  }
  return JSON.parse(result.replace(/^\uFEFF/, ""));
}
