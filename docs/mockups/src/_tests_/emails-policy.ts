/**
 * What a delivered message may contain and what `src/emails/` may import.
 * A mail client reads neither a linked stylesheet nor a remote resource, so
 * these checks run over the rendered subtree itself rather than over the
 * catalogue document that frames it.
 */

import { tokens } from "@mokly-cloud/tokens/tokens";
import type { TokenColorScheme } from "@mokly-cloud/tokens/tokens";
import { parseFragment } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";

import { logoFiles } from "../emails/brand";
import { canvasGradient, logoHeight, logoWidth } from "../emails/styles";

type Element = DefaultTreeAdapterMap["element"];

type Node = DefaultTreeAdapterMap["node"];

/** Tags a delivered message never carries, whatever a client would do. */
const forbiddenTags = ["link", "script", "form", "style", "iframe"];

/** Attributes that would fetch something, rather than name a destination. */
const resourceAttributes = ["src", "srcset", "poster", "background", "data"];

/** The two logos, by class, and the published lockup each one carries. */
const logoSources = {
  "e-logo-dark": logoFiles.dark,
  "e-logo-light": logoFiles.light,
};

/** The alternative text a client that blocks images shows for the logo. */
const logoAlt = "Mokly";

/** The wordmark the product draws as text, which a message never does. */
const wordmark = "mokly.";

/**
 * Every color one scheme's message may carry: the default Canvas surfaces,
 * the shared accent roles, and the absence of a fill the
 * mobile card falls back to.
 */
export function emailColors(scheme: TokenColorScheme): Set<string> {
  const { accent, accentSolid, onAccent } = tokens.color[scheme];
  const { background, surface, text, textMuted, border } = tokens.color[scheme];
  return new Set([
    background,
    surface,
    text,
    textMuted,
    border,
    accent,
    accentSolid,
    onAccent,
    "transparent",
  ]);
}

function descendants(node: Node): Element[] {
  const self = "tagName" in node ? [node] : [];
  return "childNodes" in node
    ? [...self, ...node.childNodes.flatMap(descendants)]
    : self;
}

function attribute(element: Element, name: string): string | undefined {
  return element.attrs.find((attr) => attr.name === name)?.value;
}

/** One element's inline declarations, by property name. */
export function declarations(element: Element): Map<string, string> {
  return new Map(
    (attribute(element, "style") ?? "")
      .split(";")
      .filter((part) => part.includes(":"))
      .map((part) => [
        part.slice(0, part.indexOf(":")).trim(),
        part.slice(part.indexOf(":") + 1).trim(),
      ]),
  );
}

function pixels(value: string | undefined): number {
  if (!value) return 0;
  const amount = Number.parseFloat(value);
  if (Number.isNaN(amount)) return 0;
  return value.endsWith("rem") ? amount * 16 : amount;
}

function withClass(elements: readonly Element[], name: string): Element[] {
  return elements.filter((element) =>
    (attribute(element, "class") ?? "").split(/\s+/).includes(name),
  );
}

/**
 * Colors are read property by property. A `*color` property names a role
 * directly; the canvas gradient and the card's shadow carry one inside a
 * larger value, so each is compared against the whole token value it is
 * resolved from rather than scanned for a literal.
 */
function colorViolations(
  elements: readonly Element[],
  scheme: TokenColorScheme,
): string[] {
  const palette = emailColors(scheme);
  const canvas = [canvasGradient(scheme), "none"];
  const shadows = [tokens.shadow[scheme].medium, "none"];
  return elements.flatMap((element) =>
    [...declarations(element)].flatMap(([property, value]) => {
      if (property.endsWith("color"))
        return palette.has(value.toLowerCase())
          ? []
          : [property + " is not a " + scheme + " token color: " + value];
      if (property === "background-image")
        return canvas.includes(value)
          ? []
          : [property + " is not the " + scheme + " canvas: " + value];
      if (property === "box-shadow")
        return shadows.includes(value)
          ? []
          : [property + " is not the " + scheme + " lifted shadow: " + value];
      return /#[0-9a-f]{3}|rgba?\(|hsla?\(/i.test(value)
        ? [property + " declares a color outside a color property: " + value]
        : [];
    }),
  );
}

/**
 * The brand is the published logo and the message's only image: both scheme
 * variants of the lockup are sent, drawn at the same size with the product's
 * name as alternative text, and the style table shows exactly one of them as
 * a block.
 */
function logoViolations(
  elements: readonly Element[],
  scheme: TokenColorScheme,
  brandRoot: string,
): string[] {
  const images = elements.filter((element) => element.tagName === "img");
  const names = Object.keys(logoSources);
  const problems =
    images.length === names.length
      ? []
      : ["the logos are the only images: " + images.length];
  const shown: string[] = [];
  for (const [name, file] of Object.entries(logoSources)) {
    const matched = withClass(images, name);
    if (matched.length !== 1) {
      problems.push("one " + name + " is drawn: " + matched.length);
      continue;
    }
    const logo = matched[0]!;
    const source = attribute(logo, "src");
    if (source !== brandRoot + file)
      problems.push(name + " is not the published lockup: " + source);
    if (attribute(logo, "alt") !== logoAlt)
      problems.push(name + " does not name the product when blocked");
    if (attribute(logo, "width") !== String(logoWidth))
      problems.push(name + " is not " + logoWidth + "px wide");
    if (attribute(logo, "height") !== String(logoHeight))
      problems.push(name + " is not " + logoHeight + "px tall");
    const style = declarations(logo);
    if (style.get("border") !== "0")
      problems.push(name + " draws a border around the lockup");
    const display = style.get("display");
    if (display === "block") shown.push(name);
    else if (display !== "none")
      problems.push(name + " is neither a block nor hidden: " + display);
  }
  if (shown.length !== 1)
    problems.push("one logo is shown in " + scheme + ": " + shown.length);
  return problems;
}

function resourceViolations(
  elements: readonly Element[],
  logos: ReadonlySet<Element>,
): string[] {
  const hrefs = new Set(
    elements.flatMap((element) => {
      const href = attribute(element, "href");
      return href ? [href] : [];
    }),
  );
  const problems = elements.flatMap((element) => {
    const brand = logos.has(element);
    return [
      ...(forbiddenTags.includes(element.tagName)
        ? ["forbidden element: " + element.tagName]
        : []),
      ...element.attrs.flatMap((attr) =>
        resourceAttributes.includes(attr.name) &&
        !(brand && attr.name === "src")
          ? ["remote resource attribute: " + attr.name]
          : [],
      ),
      ...element.attrs.flatMap((attr) =>
        attr.name !== "href" &&
        !(brand && attr.name === "src") &&
        /https?:/i.test(attr.value)
          ? ["address outside a destination: " + attr.name]
          : [],
      ),
    ];
  });
  for (const href of hrefs)
    if (!href.startsWith("https://"))
      problems.push("destination is not https: " + href);
  return problems;
}

function textNodes(node: Node): string[] {
  if ("value" in node) return [node.value];
  return "childNodes" in node ? node.childNodes.flatMap(textNodes) : [];
}

/** Every rule a rendered email subtree keeps, for one generated scheme. */
export function emailSubtreeViolations(
  html: string,
  scheme: TokenColorScheme,
  brandRoot: string,
): string[] {
  const fragment = parseFragment(html);
  const elements = descendants(fragment);
  const hrefs = new Set(
    elements.flatMap((element) => {
      const href = attribute(element, "href");
      return href ? [href] : [];
    }),
  );
  const images = elements.filter((element) => element.tagName === "img");
  const logos = new Set(
    Object.keys(logoSources).flatMap((name) => withClass(images, name)),
  );
  const problems = [
    ...colorViolations(elements, scheme),
    ...logoViolations(elements, scheme, brandRoot),
    ...resourceViolations(elements, logos),
  ];
  const message = withClass(elements, "e-message");
  if (message.length !== 1) problems.push("the message has one table");
  else {
    const style = declarations(message[0]!);
    if (
      style.get("border-collapse") !== "separate" ||
      style.get("border-spacing") !== "0" ||
      attribute(message[0]!, "cellspacing") !== "0"
    )
      problems.push(
        "message table must use separate borders with zero spacing",
      );
  }
  if (/@font-face|url\(/i.test(html)) problems.push("loads its own resource");
  for (const written of textNodes(fragment)) {
    if (written.trim().toLowerCase() === wordmark)
      problems.push("the wordmark stands in as text");
    for (const address of written.match(/https?:\/\/\S+/g) ?? [])
      if (!hrefs.has(address))
        problems.push("address with no link: " + address);
  }
  for (const element of elements)
    if (
      (attribute(element, "class") ?? "").startsWith("e-") &&
      !attribute(element, "style")
    )
      problems.push("class without resolved styles: " + element.tagName);
  const fills = elements.filter(
    (element) =>
      declarations(element).get("background-color") ===
      tokens.color[scheme].accentSolid,
  );
  const action = withClass(elements, "e-action-fill");
  const label = withClass(elements, "e-action-link");
  if (action.length !== 1 || fills.length !== 1 || fills[0] !== action[0])
    problems.push("the action cell is the message's only accent fill");
  if (label.length !== 1) problems.push("the message has one action");
  else {
    const style = declarations(label[0]!);
    if (style.get("color") !== tokens.color[scheme].onAccent)
      problems.push("the action label is not on the accent");
    if (style.get("text-decoration") !== "none")
      problems.push("the action label is underlined");
    const height =
      pixels(style.get("line-height")) +
      2 * pixels(style.get("padding")?.split(/\s+/)[0]);
    if (height < pixels(tokens.layout.controlMin))
      problems.push("the action is shorter than a control: " + height);
  }
  return problems;
}
