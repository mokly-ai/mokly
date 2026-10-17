import type { LegacyScenario } from "./legacy-adapter.mjs";
import type { RustScenario } from "./rust-adapter.mjs";

export interface EntryAddress {
  kind: string;
  path: string;
}
export interface ChangeReason {
  kind: string;
  path?: string;
  ownerPath?: string;
}
export interface ListedChange extends EntryAddress {
  previousPath?: string;
  state: string;
  reasons: ChangeReason[];
}
export interface EvidenceOwner extends EntryAddress {
  selectors: string[];
}
export interface KeptEvidence {
  key: string;
  resource: string;
  status: "applies" | "uncertain" | "resource-change";
  selectors: string[];
  owners: EvidenceOwner[];
}
export interface ExcludedEvidence {
  resource: string;
  reason: "no-selector-hit";
}
export interface ViewEvidence extends EntryAddress {
  viewport: string | null;
  colorScheme: string | null;
  state: string | null;
  ignoredIds: string[];
  kept: KeptEvidence[];
  excluded: ExcludedEvidence[];
}
export interface ConsumerEvidence extends EntryAddress {
  side: "before" | "after";
  variantPath?: string;
  viewport?: string;
  colorScheme?: string;
  via: { depth: number; component: string }[];
}
export interface AffectedConsumer {
  component: string;
  consumer: EntryAddress;
  evidence: ConsumerEvidence[];
}
export interface ResourceClosure extends EntryAddress {
  side: "before" | "after";
  viewport: string | null;
  colorScheme: string | null;
  resources: string[];
}
export interface ExportedResource {
  side: "before" | "after";
  path: string;
}
export interface BehaviourRecords {
  availability: Record<
    "catalogue" | "review" | "inventory" | "closures",
    boolean
  >;
  entries: (EntryAddress & { previousPath?: string; removed: boolean })[];
  changes: ListedChange[];
  affectedConsumers: AffectedConsumer[];
  views: ViewEvidence[];
  resourceClosures: ResourceClosure[];
  exportedResources: ExportedResource[];
}
export interface BehaviourTable extends BehaviourRecords {
  schemaVersion: 2;
}
export type BehaviourAdapter<Input> = (scenario: Input) => BehaviourRecords;
export function behaviourTable<Input>(
  scenario: Input,
  adapter: BehaviourAdapter<Input>,
): BehaviourTable;
export function readScenario(directory: string): Promise<LegacyScenario>;

export function readRustScenario(directory: string): Promise<RustScenario>;
