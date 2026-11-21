//! Pinned base preparation delegates JavaScript and HTML to one side provider boundary.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_git::identity::ObjectId;
use mokly_git::repository::Repository;
use mokly_git::tree::Limits;
use mokly_graph::prefetch::PrefetchGuard;
use mokly_graph::types::RenderGeneration;
use mokly_source_interface::tree::SourceTree;

use crate::base_freshness::PreparationInputs;
use crate::base_retention::{BaseRetentionRequest, BaseReuse, KeptBase};
use crate::base_selection::{BaseLookup, PinnedBase};
use crate::comparison_steps::Steps;
use crate::comparison_types::{Comparison, ComparisonResult};
use crate::error::{Error, Result};
use crate::extraction_snapshots::Snapshots;
use crate::git_tree::GitTree;
use crate::source_failures::SourceFailures;
use crate::sources::{GitSources, Sources};

/// Both source interfaces pin one immutable index and cancellation generation.
pub struct HistoricalSources {
    /// Typed Git failures remain fatal even when source validation reports a diagnostic.
    pub failures: Arc<dyn SourceFailures>,
    /// Catalogue, HTML, CSS, Markdown, and resource reads.
    pub tree: Arc<dyn SourceTree>,
    /// Batched dependency reads and the later sidecar's extraction inputs.
    pub sources: Arc<dyn Sources>,
}

/// Source adapter factory. It creates no checkout or package installation.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = BaseSourceFactoryMock))]
pub trait BaseSourceFactory: Send + Sync {
    /// Compose one commit-pinned source tree for one comparison generation.
    fn create(
        &self,
        repository: Arc<dyn Repository>,
        commit: ObjectId,
        root: &Path,
    ) -> Result<HistoricalSources>;
}

/// A base preparation result with the state needed for its later diagnostics.
pub struct PreparedBase {
    /// Early work remains owned by this preparation until capture ends.
    pub prefetch: Option<PrefetchGuard>,
    /// Prepared historical render generation.
    pub generation: Arc<dyn RenderGeneration>,
    /// True only when a tier-two install supplied dependencies with scripts off.
    pub scripts_off: bool,
    /// Original preparation evidence. None prevents production retention.
    pub freshness: Option<PreparationInputs>,
}

/// A base preparation failure retains whether a scripts-off tier-two install completed.
#[derive(Debug, thiserror::Error)]
#[error("[mokly-compare/base] {source}")]
pub struct BasePreparationError {
    /// True only when a tier-two install supplied dependencies with scripts off.
    pub scripts_off: bool,
    /// Original typed preparation failure.
    #[source]
    pub source: Box<Error>,
}

impl BasePreparationError {
    /// Retain the provider state beside its typed source failure.
    pub fn new(scripts_off: bool, source: Error) -> Self {
        Self {
            scripts_off,
            source: Box::new(source),
        }
    }
}

/// Result returned by a base provider after it prepares or fails to prepare.
pub type BasePreparationResult = std::result::Result<PreparedBase, BasePreparationError>;

/// Native batched Git source factory with explicit metadata and memory bounds.
pub struct GitSourceFactory {
    /// Independent tree and blob bounds.
    pub limits: Limits,
    /// Maximum retained source-blob batch bytes.
    pub batch_bytes: usize,
    /// Extraction fingerprints shared by the base readers of the process.
    pub snapshots: Arc<dyn Snapshots>,
}

impl BaseSourceFactory for GitSourceFactory {
    fn create(
        &self,
        repository: Arc<dyn Repository>,
        commit: ObjectId,
        root: &Path,
    ) -> Result<HistoricalSources> {
        let sources: Arc<dyn Sources> = Arc::new(GitSources::sharing(
            repository,
            commit,
            self.limits,
            self.snapshots.clone(),
        ));
        let tree = Arc::new(GitTree::new(root.into(), sources.clone(), self.batch_bytes));
        Ok(HistoricalSources {
            sources,
            failures: tree.clone(),
            tree,
        })
    }
}

/// Base render inputs. A sidecar provider can acquire extraction and dependency leases here.
pub struct BaseRequest<'a> {
    /// Current generation whose completed inputs govern historical dependency warnings.
    pub head: &'a dyn RenderGeneration,
    /// Current configuration locates the same config file in the historical tree.
    pub working_config: &'a ResolvedConfig,
    /// Validated repository, shared with source and dependency preparation.
    pub repository: Arc<dyn Repository>,
    /// Immutable base object id.
    pub commit: ObjectId,
    /// Shared source tree and batched dependency reader.
    pub sources: HistoricalSources,
    /// Effective lifecycle-script setting from the working configuration and CLI.
    pub install_scripts: bool,
    /// Receives the extraction, installation, and rendering steps of the base.
    pub steps: Arc<dyn Steps>,
}

/// Rendering service seam. HTML and future JavaScript base entries use the same graph.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = BaseProviderMock))]
pub trait BaseProvider: Send + Sync {
    /// Find an equal, current base and create this classification's reader.
    /// A miss releases a different or stale base before any fresh preparation.
    /// Fresh preparation samples checkout identity before its first base read,
    /// including the bounded fallback that does not call this method again.
    fn find_kept(&self, _request: &BaseRetentionRequest<'_>) -> Result<Option<BaseReuse>> {
        Ok(None)
    }

    /// Load current-version definitions and render through the common generation interface.
    fn prepare(&self, request: &BaseRequest<'_>) -> BasePreparationResult;

    /// Keep a successful capture and detach it from the preparing classification.
    /// Return its reader, or None when this provider retains no base.
    /// Retain no source failure, conversion warning, filtered checkout, or retryable fallback.
    /// Replace any existing slot. Preserve the checkout sample taken before preparation.
    fn keep(
        &self,
        _request: &BaseRetentionRequest<'_>,
        _base: Arc<KeptBase>,
    ) -> Result<Option<BaseReuse>> {
        Ok(None)
    }

    /// Release only this exact kept identity, so a late failure preserves a newer base.
    fn release(&self, _base: &Arc<KeptBase>) {}
}

/// Build and Serve call the same base-selection service.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ChangesServiceMock))]
pub trait ChangesService: Send + Sync {
    /// Validate and retain the working-tree head before static output reads it.
    fn capture_head(&self, head: Arc<dyn RenderGeneration>) -> Result<Arc<dyn RenderGeneration>>;

    /// Select the merge base once, prepare sources, and compare with the supplied head.
    fn classify(
        &self,
        config: &ResolvedConfig,
        base: Option<&str>,
        head: Arc<dyn RenderGeneration>,
        install_scripts: Option<bool>,
    ) -> Result<ComparisonResult>;
}

/// Orchestration has no direct filesystem, process, or sidecar dependency.
pub struct Changes {
    /// Repository-root identity and bounded Git operations.
    pub lookup: Arc<dyn BaseLookup>,
    /// Selection already pinned during static output admission.
    pub pinned: Option<Arc<PinnedBase>>,
    /// Batched source-tree factory.
    pub sources: Arc<dyn BaseSourceFactory>,
    /// Same HTML/JavaScript provider boundary for the historical generation.
    pub provider: Arc<dyn BaseProvider>,
    /// One materiality and attribution policy.
    pub comparison: Arc<dyn Comparison>,
    /// Receives each step of the comparison as it starts.
    pub steps: Arc<dyn Steps>,
}

impl ChangesService for Changes {
    fn capture_head(&self, head: Arc<dyn RenderGeneration>) -> Result<Arc<dyn RenderGeneration>> {
        self.comparison.capture_head(head)
    }

    fn classify(
        &self,
        config: &ResolvedConfig,
        base: Option<&str>,
        head: Arc<dyn RenderGeneration>,
        install_scripts: Option<bool>,
    ) -> Result<ComparisonResult> {
        self.classify_base(config, base, head, install_scripts)
    }
}

/// Select the same base ref for preparation and terminal failures.
pub fn selected_base<'a>(config: &'a ResolvedConfig, explicit: Option<&'a str>) -> &'a str {
    explicit
        .or_else(|| {
            config
                .input
                .review
                .as_ref()
                .and_then(|review| review.base.as_deref())
        })
        .unwrap_or("origin/main")
}

#[cfg(test)]
#[path = "_tests_/base_render_failures_tests.rs"]
mod base_render_failures_tests;

#[cfg(test)]
#[path = "_tests_/base_render_steps_tests.rs"]
mod base_render_steps_tests;

#[cfg(test)]
#[path = "_tests_/base_reuse/mod.rs"]
mod base_reuse_tests;
