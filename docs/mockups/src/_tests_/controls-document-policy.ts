import { domBackendCss } from "@firna/ui";

/** What the control policy reads besides the page itself. */
export interface ControlPolicyInput {
  /** Whether the page draws a disabled control on purpose. */
  allowDisabled: boolean;
  /** Firna's public DOM backend stylesheet, which the head must hold. */
  firnaCss: string;
}

/** The policy input of one page, with Firna's real stylesheet. */
export function controlPolicyInput(allowDisabled = false): ControlPolicyInput {
  return { allowDisabled, firnaCss: domBackendCss };
}

/**
 * Static control requirements, checked on real pages and damaged fixtures.
 * Mokly collects React Native Web's rules into a head `style` that precedes
 * the configured stylesheet links; React Native Web opens each of its rule
 * groups with a `[stylesheet-group]` marker rule, which finds them.
 */
export function controlDocumentViolations({
  allowDisabled,
  firnaCss,
}: ControlPolicyInput): string[] {
  const problems: string[] = [];
  const styles = [...document.head.querySelectorAll("style")];
  const atomic = styles.find((style) =>
    [...(style.sheet?.cssRules ?? [])].some(
      (rule) =>
        rule instanceof CSSStyleRule &&
        rule.selectorText.startsWith("[stylesheet-group="),
    ),
  );
  if (!atomic) problems.push("atomic stylesheet required");
  else if (
    [...document.head.querySelectorAll('link[rel="stylesheet"]')].some(
      (link) =>
        link.compareDocumentPosition(atomic) & Node.DOCUMENT_POSITION_FOLLOWING,
    )
  )
    problems.push("atomic styles must precede the configured stylesheets");
  if (!styles.some((style) => style.textContent?.includes(firnaCss)))
    problems.push("Firna stylesheet required");
  for (const button of document.querySelectorAll<HTMLElement>(
    '[data-testid^="firna-button-"]',
  )) {
    if (!allowDisabled && button.getAttribute("aria-disabled") === "true")
      problems.push("enabled action rendered disabled");
    // An icon-only Button draws its glyph alone: it is named by its
    // accessible name, which an element around it gives as its tooltip.
    const name = button.getAttribute("aria-label")?.trim();
    if (!button.textContent?.trim()) {
      if (!name || !button.querySelector("svg"))
        problems.push("action label required");
      else if (button.closest("[title]")?.getAttribute("title") !== name)
        problems.push("icon-only action needs its name as its tooltip");
    }
    if (button.querySelector("a, button, input, [tabindex='0']"))
      problems.push("nested interactive control");
  }
  for (const trigger of document.querySelectorAll<HTMLElement>(
    '[data-testid="firna-responsive-menu-trigger"]',
  )) {
    if (!trigger.getAttribute("aria-label")?.trim())
      problems.push("icon-only trigger needs a name");
    if (trigger.getAttribute("aria-haspopup") !== "menu")
      problems.push("menu trigger must announce its popup");
    if (
      !["true", "false"].includes(trigger.getAttribute("aria-expanded") ?? "")
    )
      problems.push("menu trigger must announce whether it is open");
  }
  for (const input of document.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement
  >(
    'input[data-testid="firna-input"], textarea[data-testid="firna-textarea"]',
  )) {
    const labelledBy = input.getAttribute("aria-labelledby");
    if (
      !labelledBy ||
      !document.getElementById(labelledBy)?.textContent?.trim()
    )
      problems.push("field label association required");
    for (const id of (input.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .filter(Boolean))
      if (!document.getElementById(id)?.textContent?.trim())
        problems.push("field description association required");
    if (input.getAttribute("aria-invalid") === "true") {
      const error = input.getAttribute("aria-errormessage");
      if (!error || !document.getElementById(error)?.textContent?.trim())
        problems.push("field error association required");
    }
    if (input.disabled && input.tabIndex !== -1)
      problems.push("disabled field must leave the tab sequence");
  }
  return problems;
}
