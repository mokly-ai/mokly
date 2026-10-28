/** The entry detail v3 reader: the version gate first, then every field. */

import { invalidData, record } from "../components/data.js";

import {
  readInstance,
  readProps,
  readRange,
  readSlot,
} from "./component_values.js";
import { readBaseAddress, readViewComparison } from "./detail_comparison.js";
import { readDetailReasons } from "./detail_reasons.js";
import { assertPublicDetail } from "./privacy.js";
import type {
  CatalogueUsage,
  DetailView,
  EntryDetailV3,
  EvidenceOwner,
  InputChange,
  UsageLink,
  ViewEvidence,
  Workspace,
} from "./types.js";
import {
  array,
  boolean,
  choice,
  counter,
  entryPath,
  hash,
  object,
  repositoryPath,
  string,
  text,
} from "./values.js";
import { MoklyVersionError } from "./version_error.js";

/** The only entry detail number this viewer reads. */
const ENTRY_DETAIL_VERSION = 3;

const KINDS = ["component", "document", "page", "screen", "use-case"] as const;
const VIEWPORTS = ["mobile", "desktop"] as const;
const SCHEMES = ["light", "dark"] as const;

/**
 * Gate the version and read one current or removed entry's detail: the
 * fields v3 defines, ignoring any other field a newer writer adds.
 */
export function readEntryDetail(value: unknown): EntryDetailV3 {
  const version = record(value) ? value.schemaVersion : undefined;
  if (version !== ENTRY_DETAIL_VERSION)
    throw new MoklyVersionError("detail", version, ENTRY_DETAIL_VERSION);
  const input = object(value);
  assertPublicDetail(input);
  const identity = object(input.identity);
  const entry = object(input.entry);
  const kind = choice(entry.kind, KINDS);
  const detail: EntryDetailV3 = {
    schemaVersion: ENTRY_DETAIL_VERSION,
    identity: { id: hash(identity.id), title: text(identity.title) },
    detailId: hash(input.detailId),
    ...(input.revision === undefined
      ? {}
      : { revision: counter(input.revision) }),
    entry: {
      path: entryPath(entry.path),
      kind,
      ...(entry.snapshotId === undefined
        ? {}
        : { snapshotId: hash(entry.snapshotId) }),
    },
    ...(input.reasons === undefined
      ? {}
      : { reasons: readDetailReasons(input.reasons) }),
    ...(input.before === undefined
      ? {}
      : {
          before: readBaseAddress(
            input.before,
            kind === "component" ? "component" : "screen",
          ),
        }),
    views: array(input.views).map(readDetailView),
    ...(input.controlOrder === undefined
      ? {}
      : { controlOrder: array(input.controlOrder).map(text) }),
    ...(input.resourceEvidence === undefined
      ? {}
      : { resourceEvidence: readViewEvidence(input.resourceEvidence) }),
    ...(input.workspace === undefined
      ? {}
      : { workspace: readWorkspace(input.workspace) }),
  };
  const current =
    detail.revision !== undefined && detail.entry.snapshotId === undefined;
  const removed =
    detail.revision === undefined && detail.entry.snapshotId !== undefined;
  if (!current && !removed)
    invalidData("$detail", "current and removed fences are exclusive");
  const visual = kind === "screen" || kind === "component";
  if (visual !== (detail.controlOrder !== undefined))
    invalidData("$detail", "only screens and components require control order");
  if (
    detail.controlOrder &&
    new Set(detail.controlOrder).size !== detail.controlOrder.length
  )
    invalidData("$detail", "control order repeats a property");
  if (!visual && detail.views.length)
    invalidData("$detail", "only screens and components have views");
  if (!visual && detail.workspace)
    invalidData("$detail", "only screens and components have a workspace");
  if (kind !== "page" && detail.resourceEvidence)
    invalidData("$detail", "only a page carries entry resource evidence");
  if (
    removed &&
    visual &&
    detail.workspace &&
    (detail.workspace.usedBy === undefined ||
      detail.workspace.affected === undefined)
  )
    invalidData("$detail", "removed visual details require workspace lists");
  if (detail.before && !(current && visual))
    invalidData("$detail", "only a current screen or component has a base");
  return detail;
}

function readDetailView(value: unknown): DetailView {
  const input = object(value);
  const ready = input.resourceEvidence !== undefined;
  return {
    viewport: choice(input.viewport, VIEWPORTS),
    colorScheme: choice(input.colorScheme, SCHEMES),
    usage: readUsage(input.usage),
    ...readViewComparison(input, ready),
    ...(ready
      ? { resourceEvidence: readViewEvidence(input.resourceEvidence) }
      : {}),
  };
}

function readUsage(value: unknown): CatalogueUsage {
  const input = object(value);
  const status = choice(input.status, [
    "ready",
    "pending",
    "unavailable",
  ] as const);
  if (status !== "ready") {
    if (
      ["instances", "slots", "ranges"].some((key) => Object.hasOwn(input, key))
    )
      invalidData("$detail.usage", "only ready usage carries records");
    return { status };
  }
  return {
    status,
    instances: array(input.instances).map(readInstance),
    slots: array(input.slots).map(readSlot),
    ranges: array(input.ranges).map(readRange),
  } as CatalogueUsage;
}

/** Read the review v8 rule and resource records of one view or page. */
function readViewEvidence(value: unknown): ViewEvidence {
  const input = object(value);
  return {
    rules: array(input.rules).map((raw) => {
      const rule = object(raw);
      return {
        stylesheet: repositoryPath(rule.stylesheet),
        selector: string(rule.selector),
        status: choice(rule.status, [
          "matched",
          "excluded",
          "unresolved",
        ] as const),
        owner: readOwner(rule.owner),
      };
    }),
    resources: array(input.resources).map((raw) => {
      const resource = object(raw);
      return {
        path: repositoryPath(resource.path),
        owner: readOwner(resource.owner),
      };
    }),
  };
}

function readOwner(value: unknown): EvidenceOwner {
  const input = object(value);
  const kind = choice(input.kind, ["entry", "component"] as const);
  if (kind === "entry") {
    if (Object.hasOwn(input, "path"))
      invalidData("$detail.owner", "an entry owner names no component");
    return { kind };
  }
  return { kind, path: entryPath(input.path) };
}

function readWorkspace(value: unknown): Workspace {
  const input = object(value);
  return {
    comparisonEligible: boolean(input.comparisonEligible),
    ...(input.usedBy === undefined
      ? {}
      : { usedBy: array(input.usedBy).map(readUsageLink) }),
    ...(input.affected === undefined
      ? {}
      : { affected: array(input.affected).map(readUsageLink) }),
    relatedComponents: array(input.relatedComponents).map((raw) => {
      const related = object(raw);
      return { path: entryPath(related.path), title: text(related.title) };
    }),
    inputChanges: array(input.inputChanges).map(readInputChange),
  };
}

function readUsageLink(value: unknown): UsageLink {
  const input = object(value);
  return {
    entryPath: entryPath(input.entryPath),
    entryKind: choice(input.entryKind, ["screen", "component"] as const),
    title: text(input.title),
    viewport: choice(input.viewport, VIEWPORTS),
    colorScheme: choice(input.colorScheme, SCHEMES),
    instanceKey: hash(input.instanceKey),
    direct: boolean(input.direct),
    removed: boolean(input.removed),
    comparisonEligible: boolean(input.comparisonEligible),
  };
}

function readInputChange(value: unknown): InputChange {
  const input = object(value);
  return {
    instanceId: text(input.instanceId),
    title: text(input.title),
    viewport: choice(input.viewport, VIEWPORTS),
    colorScheme: choice(input.colorScheme, SCHEMES),
    ...(input.variantPath === undefined
      ? {}
      : { variantPath: entryPath(input.variantPath) }),
    before: readProps(input.before) as InputChange["before"],
    after: readProps(input.after) as InputChange["after"],
  };
}
