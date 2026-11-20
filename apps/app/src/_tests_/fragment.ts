import type { Page } from "@playwright/test";

/** What the registered write-failure fragment put around one control. */
export interface FailureShape {
  /** Whether the cause is announced immediately above the control. */
  causeAbove: boolean;
  /** How many references the fragment discloses. */
  references: number;
  /** Whether the reference is disclosed beneath the control. */
  detailsBelow: boolean;
}

/**
 * Where the fragment actually put the cause and the reference, read from the
 * rendered document: what a surface meant to render is what drifted.
 *
 * A control with no fragment around it reports nothing on every count, so a
 * surface that stopped drawing one is a failure rather than a silent pass.
 */
export async function failureShape(
  page: Page,
  control: string,
): Promise<FailureShape> {
  return page.getByTestId(control).evaluate((node: Element) => {
    const fragment = node.closest(".fo-write-failure");
    if (!fragment) {
      return { causeAbove: false, references: 0, detailsBelow: false };
    }
    const precedes = (first: Element, second: Element) =>
      (first.compareDocumentPosition(second) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
      0;
    const cause = fragment.querySelector('[role="alert"]');
    const details = fragment.querySelector("details");
    return {
      causeAbove: cause !== null && precedes(cause, node),
      references: fragment.querySelectorAll("details").length,
      detailsBelow: details !== null && precedes(node, details),
    };
  });
}
