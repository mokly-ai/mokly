import type {
  MaterialPiece,
  MaterialRecipe,
} from "../../dist/components/material_recipe.js";

export const styleRecipeKinds = [
  "removal",
  "caller-copy",
  "adjacent",
  "inserts",
  "mixed",
  "arbitrary",
] as const;

export function randomStyleRecipe(trial: number, random: () => number) {
  const kind = styleRecipeKinds[trial % styleRecipeKinds.length]!;
  const styles = Array.from(
    { length: 3 },
    (_, index) =>
      `<style data-css="${index}">.entry{--v:"${"😀x".repeat(8 + (random() % 16))}";padding:${random() % 20}px}</style>`,
  );
  let source = "";
  const recipe: MaterialPiece[] = [];
  const stock = styles.map((text) => {
    const start = source.length;
    source += text;
    return { kind: "source" as const, start, end: source.length };
  });
  const marker = () =>
    `<!--mokly-component:start:r-${trial}--><!--mokly-component:end:r-${trial}-->`;
  const insert = (text: string) =>
    recipe.push({ kind: "insert", text, references: [], verbatim: true });
  const append = (text: string) => {
    source += marker();
    const start = source.length;
    source += text;
    recipe.push({ kind: "source", start, end: source.length });
  };
  const chunks = (text: string) => {
    for (let start = 0; start < text.length;) {
      const end = Math.min(text.length, start + 1 + (random() % 30));
      append(text.slice(start, end));
      start = end;
    }
  };
  const chosen = random() % styles.length;
  const wrapper = '<mokly-caller-slot data-key="k1" data-rendered="true">';
  if (kind === "removal") {
    recipe.push(stock[0]!);
    chunks(styles[chosen]!);
  } else if (kind === "caller-copy") {
    insert(wrapper);
    const item = stock[chosen]!;
    const cut = item.start + 7 + (random() % (item.end - item.start - 20));
    recipe.push({ ...item, end: cut, copy: item });
    append(source.slice(cut, item.end));
    insert("</mokly-caller-slot>");
  } else if (kind === "adjacent") {
    const item = stock[chosen]!;
    const cut = item.start + Math.floor((item.end - item.start) / 2);
    recipe.push({ ...item, end: cut }, { ...item, start: cut });
    recipe.push({ ...item, copy: item }, { ...item, copy: item });
  } else if (kind === "inserts") {
    const style = `<style>.entry{color:red}</style data-copy=${wrapper}`;
    styles.push(style);
    append(style);
    append(style.slice(0, -wrapper.length));
    insert(wrapper);
  } else if (kind === "mixed") {
    recipe.push(stock[0]!, { ...stock[1]!, copy: stock[1]! });
    insert("<!--mokly-owned:action:k1-->");
    chunks(styles[chosen]!);
    insert("<!--mokly-review-ignore:clock-->");
    recipe.push(stock[2]!);
  } else {
    for (let count = 0; count < 3 + (random() % 12); count++) {
      const item = stock[random() % stock.length]!;
      const start = item.start + (random() % (item.end - item.start));
      const end = Math.min(item.end, start + 1 + (random() % 60));
      if (random() % 3 === 0) insert("<!--mokly-review-ignore:clock-->");
      else recipe.push({ kind: "source", start, end, copy: item });
    }
    if (random() % 2) chunks(styles[chosen]!);
  }
  return { kind, source, recipe, styles };
}

/** Build the actual recipe text, then count complete S matches crossing real joins. */
export function crossingStyleOccurrences(
  source: string,
  recipe: MaterialRecipe,
  styles: readonly string[],
) {
  const seams: number[] = [];
  let previous: MaterialPiece | undefined;
  let material = "";
  for (const piece of recipe) {
    const text =
      piece.kind === "source"
        ? source.slice(piece.start, piece.end)
        : piece.text;
    if (!text) continue;
    if (
      previous &&
      !(
        previous.kind === "source" &&
        piece.kind === "source" &&
        previous.end === piece.start
      )
    )
      seams.push(material.length);
    material += text;
    previous = piece;
  }
  let crossings = 0;
  for (const style of new Set(styles))
    for (
      let start = material.indexOf(style);
      start !== -1;
      start = material.indexOf(style, start + 1)
    )
      if (seams.some((seam) => start < seam && seam < start + style.length))
        crossings++;
  return crossings;
}
