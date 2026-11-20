import type { productFamilies, productStates } from "./product-families";

export type ProductSituation = {
  path: string;
  family: keyof typeof productFamilies;
  screen: string;
  name: string;
  states: readonly (typeof productStates)[number][];
  /** The path of the situation this one belongs to, rather than the screen. */
  parent?: string;
  /**
   * The situation is a screen beside its parent, in the folder the parent's
   * path owns, and never one of the parent's variants: the build details
   * beside the running build are screens of their own.
   */
  sibling?: boolean;
  /**
   * The drawing holds a write or a read in flight, so a refused press or a
   * control that waits disabled is the point.
   */
  pending?: boolean;
  /**
   * The pane opened an overlay over itself — a confirmation, a reveal or its
   * row menu — so the document carries the overlay's dialog beside the
   * frame's, and the mobile layer carries the overlay's where a pane alone
   * carries none.
   */
  overlay?: boolean;
};
