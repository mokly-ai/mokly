import { MoklyError } from "../errors.js";

/** Stable reasons why an accepted generation cannot produce a Live bundle. */
export enum InteractiveBundleReason {
  SourceNotCaptured = "source-not-captured",
}

/** A consumer-facing Live bundle failure with structured source context. */
export class InteractiveBundleError extends MoklyError {
  constructor(
    readonly reason: InteractiveBundleReason,
    readonly module: string,
    readonly importer?: string,
  ) {
    super(
      "interactive-bundle",
      `accepted Live sources do not contain ${module}${
        importer ? ` (imported by ${importer})` : ""
      }`,
    );
    this.name = "InteractiveBundleError";
  }
}

/** Stable reasons why one catalogue view cannot offer Live rendering. */
export enum InteractiveViewEligibilityReason {
  MissingVariant = "missing-variant",
  NotLiveKind = "not-live-kind",
  OptedOut = "opted-out",
  UnexpectedVariant = "unexpected-variant",
  UnknownEntry = "unknown-entry",
  UnknownVariant = "unknown-variant",
}

/** A request for a catalogue view that is not eligible for Live rendering. */
export class InteractiveViewEligibilityError extends Error {
  constructor(
    readonly reason: InteractiveViewEligibilityReason,
    readonly entryId: string,
    readonly variantId?: string,
  ) {
    super(eligibilityMessage(reason, entryId, variantId));
    this.name = "InteractiveViewEligibilityError";
  }
}

/** An internal failure while validating or composing a Live document. */
export class InteractiveDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InteractiveDocumentError";
  }
}

function eligibilityMessage(
  reason: InteractiveViewEligibilityReason,
  entryId: string,
  variantId?: string,
): string {
  switch (reason) {
    case InteractiveViewEligibilityReason.UnknownEntry:
      return `Live entry is unknown: ${entryId}`;
    case InteractiveViewEligibilityReason.NotLiveKind:
      return `Live entry is not a screen or component: ${entryId}`;
    case InteractiveViewEligibilityReason.OptedOut:
      return `Live entry opted out: ${entryId}`;
    case InteractiveViewEligibilityReason.MissingVariant:
      return `Live component needs a saved variant: ${entryId}`;
    case InteractiveViewEligibilityReason.UnknownVariant:
      return `Live component has unknown saved variant: ${variantId ?? "<missing>"}`;
    case InteractiveViewEligibilityReason.UnexpectedVariant:
      return `Live screen cannot name a component variant: ${entryId}`;
  }
}
