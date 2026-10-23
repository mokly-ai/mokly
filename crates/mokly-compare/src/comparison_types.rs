//! Retained comparison output contains metadata and graph handles, never document trees.

use std::fmt;
use std::sync::Arc;

use mokly_catalogue::diagnostic::Warning;
use mokly_graph::types::RenderGeneration;
use mokly_model::axes::{ColorScheme, EntryKind, Viewport};
use mokly_model::evidence::ViewEvidence;
use mokly_model::review::{EntryChangeReason, ReviewResultV8, ReviewState};
use mokly_model::snapshot::CatalogueChangeSnapshotV4;

use crate::comparison_capture;
use crate::comparison_error::CompareResult;
use crate::error::Result;
use crate::move_types::Pairing;
use crate::resource_memo::ResourceWork;

/// Document identity. Pages and documents have no viewport axis.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub struct ViewKey {
    /// Absent on pages and documents.
    pub viewport: Option<Viewport>,
    /// Effective scheme; pages always use light.
    pub color_scheme: ColorScheme,
}

/// Classified view metadata used by static output and Serve details.
#[derive(Clone, Debug)]
pub struct DocumentComparison {
    /// View axes.
    pub key: ViewKey,
    /// Original base route relative to the graph's generated namespace.
    pub before_route: Option<String>,
    /// Original head route relative to the graph's generated namespace.
    pub after_route: Option<String>,
    /// Complete materiality state.
    pub state: ReviewState,
    /// Paired ignore ids.
    pub ignored_ids: Vec<String>,
    /// Ready rule and resource records, with explicit empty arrays.
    pub evidence: ViewEvidence,
}

/// Entry classification includes pages and documents without synthetic review records.
#[derive(Clone, Debug)]
pub struct EntryClassification {
    /// Entry kind.
    pub kind: EntryKind,
    /// Current path, or selected removed path.
    pub path: String,
    /// Accepted base counterpart on moved entries only.
    pub previous_path: Option<String>,
    /// Aggregate entry state.
    pub state: ReviewState,
    /// Direct Changes membership.
    pub included: bool,
    /// Complete direct reasons.
    pub reasons: Vec<EntryChangeReason>,
    /// View or document union in canonical axis order.
    pub documents: Vec<DocumentComparison>,
}

/// The terminal and shell use the same counts.
#[derive(Clone, Copy, Debug, Default)]
pub struct ComparisonCounts {
    /// Included current and selected removed entries, including variants.
    pub changes: usize,
    /// Accepted moves, counted once within changes too.
    pub moved: usize,
    /// Entries whose aggregate state is ignored-only.
    pub ignored_only: usize,
}

/// Complete validated comparison, retained for later snapshot and static delivery.
pub struct ComparisonResult {
    /// Observed route reads, comparisons, diffs, and bounded resource retention.
    pub resource_work: ResourceWork,
    /// Actual indexed consumer identity lookups.
    pub affected_lookups: usize,
    /// Actual indexed classification-to-review lookups.
    pub validation_lookups: usize,
    /// Base-side preparation and composition warnings remain outside public JSON.
    pub warnings: Vec<Warning>,
    /// Strict review v8.
    pub review: ReviewResultV8,
    /// Membership and selected historical metadata v4.
    pub snapshot: CatalogueChangeSnapshotV4,
    /// Classification of every surviving entry identity.
    pub entries: Vec<EntryClassification>,
    /// Accepted kind-aware pairing.
    pub pairing: Pairing,
    /// Shared terminal and index counts.
    pub counts: ComparisonCounts,
    /// Bounded captured base over the pinned source; misses read that same source.
    pub before: Arc<dyn RenderGeneration>,
    /// Original working generation; head reads use its bounded render cache.
    pub after: Arc<dyn RenderGeneration>,
}

impl fmt::Debug for ComparisonResult {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("ComparisonResult")
            .field("snapshot", &self.snapshot)
            .field("counts", &self.counts)
            .finish_non_exhaustive()
    }
}

/// One catalogue-wide policy serves every command and comparison route.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ComparisonMock))]
pub trait Comparison: Send + Sync {
    /// Validate and retain bounded base inputs before comparison begins.
    fn capture_base(&self, before: Arc<dyn RenderGeneration>) -> Result<Arc<dyn RenderGeneration>> {
        comparison_capture::capture(before).compare()
    }

    /// Classify a base whose complete validation and bounded capture already finished.
    /// The base can be the original source when its validation summary did not fit.
    fn compare_prepared(
        &self,
        request: &ComparisonRequest,
        before: Arc<dyn RenderGeneration>,
        after: Arc<dyn RenderGeneration>,
    ) -> Result<ComparisonResult>;
}

/// Immutable identity fence for one catalogue-wide comparison.
#[derive(Clone, Debug)]
pub struct ComparisonRequest {
    /// Effective configured or command-line base ref.
    pub base_ref: String,
    /// Pinned merge-base object id.
    pub base_commit: String,
    /// Stable catalogue identity used by historical snapshot ids.
    pub catalogue_identity: String,
}
