export interface LegacyScenario {
  catalogue?: unknown;
  review?: unknown;
  inventory?: unknown;
  closures?: unknown;
}

export interface BehaviourTable {
  schemaVersion: 1;
  availability: Record<
    "catalogue" | "review" | "inventory" | "closures",
    boolean
  >;
  entries: {
    kind: string;
    path: string;
    previousPath?: string;
    removed: boolean;
  }[];
  changes: { kind: string; path: string; state: string; reasons: unknown[] }[];
  affectedConsumers: unknown[];
  views: {
    kind: string;
    path: string;
    viewport: string | null;
    colorScheme: string | null;
    state: string | null;
    ignoredIds: string[];
    kept: unknown[];
    excluded: unknown[];
  }[];
  resourceClosures: unknown[];
}

export function behaviourTable(scenario: LegacyScenario): BehaviourTable;
export function readScenario(directory: string): Promise<LegacyScenario>;
