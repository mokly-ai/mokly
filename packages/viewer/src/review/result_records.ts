/** The strict shapes of the review result v8 records, without cross references. */

import { decodeProps } from "../components/codec.js";
import type { ComponentWireProps } from "../components/prop_types.js";
import type { EvidenceOwner } from "../generated/catalogue/EvidenceOwner.js";
import type { ResourceEvidence } from "../generated/catalogue/ResourceEvidence.js";
import type { RuleEvidence } from "../generated/catalogue/RuleEvidence.js";

import {
  reviewArray,
  reviewBoolean,
  reviewChoice,
  reviewDigest,
  reviewEntryPath,
  reviewIgnoreId,
  reviewInvalid,
  reviewObject,
  reviewResourcePath,
  reviewString,
  reviewText,
} from "./result_helpers.js";
import type {
  AffectedConsumer,
  AffectedUsageEvidence,
  EntryChangeReason,
  ReviewDiagnostic,
  ReviewEntry,
  ReviewEntryAddress,
  ReviewKind,
  ReviewView,
} from "./types.js";

const KINDS = ["component", "screen", "use-case"] as const;
const STATES = [
  "unchanged",
  "changed",
  "added",
  "removed",
  "ignored-only",
] as const;
const VIEWPORTS = ["mobile", "desktop"] as const;
const SCHEMES = ["light", "dark"] as const;
const PLAIN_REASONS = [
  "added",
  "removed",
  "metadata",
  "material",
  "implementation",
  "inputs",
  "structure",
] as const;

/** One entry; only a component parent groups variants, which group none. */
export function readEntry(value: unknown, variant = false): ReviewEntry {
  const record = reviewObject(
    value,
    ["kind", "path", "title", "state", "included", "reasons", "views"],
    ["before", "after", "previousPath", "variants"],
  );
  const kind = reviewChoice(record.kind, KINDS);
  const entry: ReviewEntry = {
    kind,
    path: reviewEntryPath(record.path),
    title: reviewText(record.title),
    state: reviewChoice(record.state, STATES),
    included: reviewBoolean(record.included),
    reasons: reviewArray(record.reasons).map(readReason),
    views: reviewArray(record.views).map(readView),
  };
  if (record.before !== undefined)
    entry.before = readAddress(record.before, kind);
  if (record.after !== undefined) entry.after = readAddress(record.after, kind);
  if (record.previousPath !== undefined)
    entry.previousPath = reviewEntryPath(record.previousPath);
  if (record.variants !== undefined) {
    if (variant || kind !== "component")
      reviewInvalid("only a component parent groups variants");
    entry.variants = reviewArray(record.variants).map((item) =>
      readEntry(item, true),
    );
  }
  return entry;
}

/** One side's address: props on screens and components, slots on components. */
function readAddress(value: unknown, kind: ReviewKind): ReviewEntryAddress {
  const record = reviewObject(
    value,
    kind === "use-case"
      ? ["path", "title"]
      : kind === "screen"
        ? ["path", "title", "props"]
        : ["path", "title", "props", "suppliedSlots"],
  );
  const address: ReviewEntryAddress = {
    path: reviewEntryPath(record.path),
    title: reviewText(record.title),
  };
  if (kind !== "use-case") {
    decodeProps(record.props);
    address.props = record.props as ComponentWireProps;
  }
  if (kind === "component")
    address.suppliedSlots = reviewArray(record.suppliedSlots).map(reviewString);
  return address;
}

function readReason(value: unknown): EntryChangeReason {
  if (!value || typeof value !== "object" || !("kind" in value))
    reviewInvalid("invalid reason");
  if (value.kind === "dependency") {
    const reason = reviewObject(value, ["kind", "path"]);
    return { kind: "dependency", path: reviewResourcePath(reason.path) };
  }
  if (value.kind === "screen") {
    const reason = reviewObject(value, ["kind", "screenPath"]);
    return { kind: "screen", screenPath: reviewEntryPath(reason.screenPath) };
  }
  const reason = reviewObject(value, ["kind"]);
  return { kind: reviewChoice(reason.kind, PLAIN_REASONS) };
}

/** One view; empty evidence lists are omitted, never written as `[]`. */
function readView(value: unknown): ReviewView {
  const record = reviewObject(
    value,
    ["viewport", "colorScheme", "state", "ignoredIds"],
    ["rules", "resources"],
  );
  const view: ReviewView = {
    viewport: reviewChoice(record.viewport, VIEWPORTS),
    colorScheme: reviewChoice(record.colorScheme, SCHEMES),
    state: reviewChoice(record.state, STATES),
    ignoredIds: reviewArray(record.ignoredIds).map(reviewIgnoreId),
  };
  if (record.rules !== undefined) view.rules = evidence(record.rules, readRule);
  if (record.resources !== undefined)
    view.resources = evidence(record.resources, readResource);
  return view;
}

function evidence<T>(value: unknown, read: (item: unknown) => T): T[] {
  const items = reviewArray(value);
  if (!items.length) reviewInvalid("an empty evidence list is omitted");
  return items.map(read);
}

function readRule(value: unknown): RuleEvidence {
  const record = reviewObject(value, [
    "stylesheet",
    "selector",
    "status",
    "owner",
  ]);
  return {
    stylesheet: reviewResourcePath(record.stylesheet),
    selector: reviewString(record.selector),
    status: reviewChoice(record.status, [
      "matched",
      "excluded",
      "unresolved",
    ] as const),
    owner: readOwner(record.owner),
  };
}

function readResource(value: unknown): ResourceEvidence {
  const record = reviewObject(value, ["path", "owner"]);
  return {
    path: reviewResourcePath(record.path),
    owner: readOwner(record.owner),
  };
}

function readOwner(value: unknown): EvidenceOwner {
  if (!value || typeof value !== "object" || !("kind" in value))
    reviewInvalid("invalid evidence owner");
  if (value.kind === "entry") {
    reviewObject(value, ["kind"]);
    return { kind: "entry" };
  }
  const owner = reviewObject(value, ["kind", "path"]);
  if (owner.kind !== "component") reviewInvalid("invalid evidence owner");
  return { kind: "component", path: reviewEntryPath(owner.path) };
}

export function readAffected(value: unknown): AffectedConsumer {
  const record = reviewObject(value, [
    "changedComponentId",
    "consumer",
    "evidence",
  ]);
  const consumer = reviewObject(record.consumer, ["kind", "path"]);
  const evidence = reviewArray(record.evidence).map(readUsage);
  if (!evidence.length) reviewInvalid("affected evidence is empty");
  return {
    changedComponentId: reviewEntryPath(record.changedComponentId),
    consumer: {
      kind: reviewChoice(consumer.kind, ["component", "screen"] as const),
      path: reviewEntryPath(consumer.path),
    },
    evidence,
  };
}

function readUsage(value: unknown): AffectedUsageEvidence {
  const record = reviewObject(value, ["side", "context", "via"]);
  const context = reviewObject(record.context, [
    "kind",
    "entry",
    "viewport",
    "colorScheme",
  ]);
  const kind = reviewChoice(context.kind, ["component", "screen"] as const);
  const via = reviewArray(record.via).map((raw) => {
    const edge = reviewObject(raw, ["componentId", "instanceKey"]);
    return {
      componentId: reviewEntryPath(edge.componentId),
      instanceKey: reviewDigest(edge.instanceKey),
    };
  });
  if (!via.length) reviewInvalid("an ownership chain is empty");
  return {
    side: reviewChoice(record.side, ["before", "after"] as const),
    context: {
      kind,
      entry: readAddress(context.entry, kind),
      viewport: reviewChoice(context.viewport, VIEWPORTS),
      colorScheme: reviewChoice(context.colorScheme, SCHEMES),
    },
    via,
  };
}

export function readDiagnostic(value: unknown): ReviewDiagnostic {
  const record = reviewObject(value, ["message"]);
  return { message: reviewString(record.message) };
}
