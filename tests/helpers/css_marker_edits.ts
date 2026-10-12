export function markerEncoder(seed: number) {
  let state = seed;
  const random = (limit: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % limit;
  };
  const lengths = new Set<number>();
  const terminators = new Set<string>();
  const continuations = new Set<string>();
  return {
    lengths,
    terminators,
    continuations,
    encode(text: string, index: number, inString: boolean): string {
      const tokens = [...text].map((character, position) => {
        const mustEscape =
          position === 0 || (!inString && !/[-_a-zA-Z0-9]/.test(character));
        if (!mustEscape && random(3) === 0)
          return { text: character, hex: false, length: 0, terminator: "" };
        const raw = character.codePointAt(0)!.toString(16);
        const length = raw.length + random(7 - raw.length);
        lengths.add(length);
        const upper = random(2) === 0;
        const value = raw.padStart(length, "0");
        const terminator = ["", " ", "\t", "\n", "\r", "\r\n", "\f"][
          random(7)
        ]!;
        return {
          text: `\\${upper ? value.toUpperCase() : value}`,
          hex: true,
          length,
          terminator,
        };
      });
      if (index % 3 === 0)
        tokens[0] = { text: "\\3C", hex: true, length: 2, terminator: "" };
      if (index % 3 === 1)
        tokens[0] = { text: "\\00003c", hex: true, length: 6, terminator: " " };
      return tokens
        .map((token, position) => {
          let terminator = token.terminator;
          if (
            token.hex &&
            token.length < 6 &&
            !terminator &&
            /^[a-fA-F0-9]/.test(tokens[position + 1]?.text ?? "")
          )
            terminator = " ";
          if (token.hex) terminators.add(terminator);
          let continuation = "";
          if (inString && (position === 4 || random(13) === 0)) {
            const newline = ["\n", "\r", "\r\n", "\f"][random(4)]!;
            continuations.add(newline);
            continuation = `\\${newline}`;
          }
          return token.text + terminator + continuation;
        })
        .join("");
    },
  };
}
