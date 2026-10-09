/** View-local lazy analyses, shared across quick-check fall-through. */
import type { GeneratedComponentView } from "@mokly/viewer/data";

import type { PreparedInlineRules } from "./css/inline_preparation.js";
import type { InlineStyleSpan } from "./css/inline_styles.js";
import { FingerprintSourceProofs } from "./fingerprint_source_proofs.js";
import {
  normalizeReviewPair,
  parseReviewDocument,
  type NormalizedReviewPair,
  type ReviewLinkNormalization,
} from "./ignore.js";
import { PageAnalysis } from "./page_analysis.js";

export class PageAnalysisPair {
  inlinePreparation?: PreparedInlineRules;
  private base?: PageAnalysis;
  private head?: PageAnalysis;
  private normalized?: NormalizedReviewPair;
  private paired?: readonly string[];
  private exclusion?: (path: string) => boolean;
  private proofs?: FingerprintSourceProofs;
  private safeStyles?: readonly Pick<InlineStyleSpan, "source" | "text">[];
  constructor(
    readonly before: GeneratedComponentView,
    readonly after: GeneratedComponentView,
    readonly baseText: string,
    readonly headText: string,
    readonly links?: ReviewLinkNormalization,
    readonly root?: string,
  ) {}

  get beforeAnalysis(): PageAnalysis {
    return (this.base ??= new PageAnalysis(
      this.baseText,
      this.before.path,
      this.before.usage,
    ));
  }
  get afterAnalysis(): PageAnalysis {
    return (this.head ??= new PageAnalysis(
      this.headText,
      this.after.path,
      this.after.usage,
    ));
  }
  get pairedIgnoreIds(): readonly string[] {
    if (this.normalized) return this.normalized.pairedIgnoreIds;
    if (this.paired) return this.paired;
    if (this.baseText === this.headText)
      return (this.paired = this.afterAnalysis.regions
        .map(({ id }) => id)
        .sort());
    const validated = this.base
      ? undefined
      : parseReviewDocument(this.baseText, this.after.path);
    const before = this.base?.regions ?? [...validated!.regions.values()];
    const after = this.afterAnalysis;
    const headIds = new Set(after.regions.map(({ id }) => id));
    const common = before.filter(({ id }) => headIds.has(id));
    if (!common.length) return (this.paired = []);
    const beforeMaterials = this.base?.materialIds ?? validated!.materials;
    const afterMaterials = after.materialIds;
    return (this.paired = common
      .filter(({ id }) => beforeMaterials.has(id) === afterMaterials.has(id))
      .map(({ id }) => id)
      .sort());
  }

  /** Complete-path proofs live only as long as this compared view. */
  get fingerprintProofs(): FingerprintSourceProofs {
    return (this.proofs ??= new FingerprintSourceProofs(
      this.baseText,
      this.headText,
    ));
  }

  rememberStyleSafety(spans: readonly InlineStyleSpan[]): void {
    this.safeStyles = spans.map(({ source, text }) => ({ source, text }));
  }

  hasStyleSafetyProof(
    before: readonly InlineStyleSpan[],
    after: readonly InlineStyleSpan[],
  ): boolean {
    const proved = this.safeStyles;
    return (
      proved !== undefined &&
      [before, after].every(
        (spans) =>
          spans.length === proved.length &&
          spans.every(
            (span, index) =>
              span.source === proved[index]!.source &&
              span.text === proved[index]!.text,
          ),
      )
    );
  }

  get normalization(): NormalizedReviewPair {
    return (this.normalized ??= normalizeReviewPair(
      this.baseText,
      this.headText,
      this.after.path,
      this.links,
    ));
  }

  normalize(base: string, head: string): NormalizedReviewPair {
    return base === this.baseText && head === this.headText
      ? this.normalization
      : normalizeReviewPair(base, head, this.after.path, this.links);
  }

  resourceExclusion(
    create: () => (path: string) => boolean,
  ): (path: string) => boolean {
    return (this.exclusion ??= create());
  }
}
