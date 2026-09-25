/** Shared classification of CSS and HTML resource references. */
export type ResourceUrlClassification =
  | { readonly kind: "external" }
  | { readonly kind: "local" }
  | {
      readonly kind: "invalid";
      readonly reason:
        "protocol-relative" | "root-absolute" | "unsupported scheme";
    };

/** CSS protocol-relative URLs are external; HTML links keep their portability rules. */
export function classifyResourceUrl(
  value: string,
  source: "css" | "html",
): ResourceUrlClassification {
  if (
    !value ||
    /^(?:https?:|data:)/i.test(value) ||
    (source === "html" && /^(?:mailto:|tel:)/i.test(value)) ||
    (source === "css" && value.startsWith("#")) ||
    (source === "css" && value.startsWith("//"))
  )
    return { kind: "external" };
  if (value.startsWith("//"))
    return { kind: "invalid", reason: "protocol-relative" };
  if (value.startsWith("/"))
    return { kind: "invalid", reason: "root-absolute" };
  if (/^[a-z][a-z0-9+.-]*:/i.test(value))
    return { kind: "invalid", reason: "unsupported scheme" };
  return { kind: "local" };
}
