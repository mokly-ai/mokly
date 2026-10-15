import type { BehaviourRecords } from "./behaviour-table.mjs";

interface Axes {
  viewport?: string;
  colorScheme?: string;
}
interface LegacyReason {
  kind: string;
  path?: string;
  screenPath?: string;
  analysis?: {
    status?: string;
    selectors?: string[];
    rules?: {
      ruleKey?: string;
      status: string;
      selectors: string[];
      changedComponentPaths?: string[];
      pageSelectors?: string[];
    }[];
  };
}
interface LegacyEvidence {
  reasons?: LegacyReason[];
  excludedResources?: { path: string; reason: string }[];
}
interface LegacyView extends Axes, LegacyEvidence {
  state?: string;
  ignoredIds?: string[];
  resourceEvidence?: LegacyEvidence;
}
interface LegacyEntry extends Axes {
  kind?: string;
  path: string;
  previousPath?: string;
  state?: string;
  views?: LegacyView[];
  variants?: LegacyEntry[];
  changes?: { status: string; included: boolean; kind: string };
}
export interface LegacyScenario {
  catalogue?: {
    schemaVersion: number;
    deploymentId?: string;
    screens?: LegacyEntry[];
    components?: LegacyEntry[];
    pages?: LegacyEntry[];
    documents?: LegacyEntry[];
    useCases?: LegacyEntry[];
    removedEntries?: { entry: LegacyEntry }[];
  };
  review?: {
    schemaVersion: number;
    screens?: LegacyEntry[];
    components?: LegacyEntry[];
    changes?: {
      kind: string;
      before?: { path: string };
      after?: { path: string };
      previousPath?: string;
      reasons: LegacyReason[];
    }[];
    affectedConsumers?: {
      changedComponentId: string;
      consumer: { kind: string; path: string };
      evidence: {
        side: string;
        context: Axes & {
          kind: string;
          entry: { path: string };
          variantPath?: string;
        };
        via: { componentId: string; instanceKey?: string }[];
      }[];
    }[];
  };
  inventory?: {
    schemaVersion: number;
    files: { path: string; sha256?: string; size?: number }[];
  };
  closures?: {
    path: string;
    side?: string;
    viewport?: string | null;
    colorScheme?: string | null;
    resources: string[];
  }[];
}
export function adaptLegacyScenario(scenario: LegacyScenario): BehaviourRecords;
