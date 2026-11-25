export interface BundleExports {
  entries: Record<string, Record<string, unknown>>;
  stories: Record<string, Record<string, unknown>>;
  renderer?: { default?: unknown };
  preview?: Record<string, unknown>;
  styleAdapters?: { styled?: unknown; native?: unknown; emotion?: unknown };
}
