const key = "a".repeat(64);
const region = (id: string, text: string) =>
  `<!--mokly-review-ignore:start:${id}-->${text}<!--mokly-review-ignore:end:${id}-->`;
const signal = (id: string) => `<!--mokly-review-material:${id}:${key}-->`;
const style = (value: number) => `<style>.entry{padding:${value}px}</style>`;
export const modelKinds = [
  "component",
  "region",
  "adoption",
  "signal",
  "style",
  "caller",
  "insert",
  "plain",
] as const;

export function modelSources(
  template: string,
  trial: number,
  random: () => number,
) {
  const kind = modelKinds[trial % modelKinds.length]!;
  let before = style(1);
  let after = style(2);
  let left = "left";
  let right = "right";
  let caller = "caller";
  let tailBefore = "";
  let tailAfter = "";
  const opener = random() % 2 ? "<!--mokly-review-" : "<!--mokly-component:";
  const suffix = opener.includes("review")
    ? `material:clock:${key}-->`
    : "start:r-99-->";
  const cut = 1 + (random() % (opener.length - 1));
  switch (kind) {
    case "component":
      left = "<";
      right = `!--mokly-review-material:clock:${key}-->`;
      before += region("clock", "same");
      after += region("clock", "same");
      break;
    case "region":
    case "adoption": {
      const split =
        opener.slice(0, cut) + region("join", opener.slice(cut) + suffix);
      before +=
        split +
        region("clock", "same") +
        (kind === "adoption" ? signal("join") : "");
      after +=
        (kind === "adoption" ? split : "ordinary") + region("clock", "same");
      break;
    }
    case "signal":
      before += `mokly-in${signal("clock")}line-style:D-->${region("clock", "same")}`;
      after += region("clock", "same");
      break;
    case "style":
      before =
        opener.slice(0, cut) +
        style(1) +
        opener.slice(cut) +
        suffix +
        region("clock", "same");
      after =
        opener.slice(0, cut) +
        style(2) +
        opener.slice(cut) +
        suffix +
        region("clock", "same");
      break;
    case "caller":
      caller =
        '<style media="screen">.x{content:"mokly-in<!--mokly-component:start:r-999-->line-style:D-->"}</style>';
      break;
    case "insert":
      before = style(1) + region("base", "same");
      after = style(1) + region("head", "same");
      tailBefore = tailAfter = "<textarea><!--mokly-review-</textarea>";
      break;
    case "plain":
      before += region("clock", "same");
      after += region("clock", "changed");
      break;
  }
  const decorate = (head: string, tail: string) =>
    template
      .replace("</head>", head + "</head>")
      .replace("LEFT", left)
      .replace("RIGHT", right)
      .replace("CALLER", caller)
      .replace("</body>", tail + "</body>");
  return {
    kind,
    opener,
    before: decorate(before, tailBefore),
    after: decorate(after, tailAfter),
    skipped: kind === "insert",
  };
}
