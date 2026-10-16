//! Pinned base preparation delegates JavaScript and HTML to one side provider boundary.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::relative;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_git::identity::ObjectId;
use mokly_git::repository::{Repositories, Repository};
use mokly_git::tree::Limits;
use mokly_graph::types::RenderGeneration;
use mokly_model::material::catalogue_key;
use mokly_source_interface::tree::SourceTree;

use crate::comparison_error::CompareResult;
use crate::comparison_types::{Comparison, ComparisonRequest, ComparisonResult};
use crate::error::{Error, GitResult, Result};
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

/// Native batched Git source factory with explicit metadata and memory bounds.
pub struct GitSourceFactory {
    /// Independent tree and blob bounds.
    pub limits: Limits,
    /// Maximum retained source-blob batch bytes.
    pub batch_bytes: usize,
}

impl BaseSourceFactory for GitSourceFactory {
    fn create(
        &self,
        repository: Arc<dyn Repository>,
        commit: ObjectId,
        root: &Path,
    ) -> Result<HistoricalSources> {
        let sources: Arc<dyn Sources> = Arc::new(GitSources::new(repository, commit, self.limits));
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
    /// Current configuration locates the same config file in the historical tree.
    pub working_config: &'a ResolvedConfig,
    /// Validated repository, shared with source and dependency preparation.
    pub repository: Arc<dyn Repository>,
    /// Immutable base object id.
    pub commit: ObjectId,
    /// Shared source tree and batched dependency reader.
    pub sources: HistoricalSources,
}

/// Rendering service seam. HTML and future JavaScript base entries use the same graph.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = BaseProviderMock))]
pub trait BaseProvider: Send + Sync {
    /// Load current-version definitions and render through the common generation interface.
    fn prepare(&self, request: &BaseRequest<'_>) -> Result<Arc<dyn RenderGeneration>>;
}

/// Build and Serve call the same base-selection service.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ChangesServiceMock))]
pub trait ChangesService: Send + Sync {
    /// Select the merge base once, prepare sources, and compare with the supplied head.
    fn classify(
        &self,
        config: &ResolvedConfig,
        base: Option<&str>,
        head: Arc<dyn RenderGeneration>,
    ) -> Result<ComparisonResult>;
}

/// Orchestration has no direct filesystem, process, or sidecar dependency.
pub struct Changes {
    /// Repository-root identity and bounded Git operations.
    pub repositories: Arc<dyn Repositories>,
    /// Batched source-tree factory.
    pub sources: Arc<dyn BaseSourceFactory>,
    /// Same HTML/JavaScript provider boundary for the historical generation.
    pub provider: Arc<dyn BaseProvider>,
    /// One materiality and attribution policy.
    pub comparison: Arc<dyn Comparison>,
}

impl ChangesService for Changes {
    fn classify(
        &self,
        config: &ResolvedConfig,
        base: Option<&str>,
        head: Arc<dyn RenderGeneration>,
    ) -> Result<ComparisonResult> {
        let base = selected_base(config, base);
        let (repository, commit) = {
            let span = tracing::info_span!("review.base-commit", status = "error");
            let _entered = span.enter();
            let repository = self.repositories.open(&config.repo_root).base()?;
            let commit = repository.merge_base(base).base()?;
            span.record("status", "ok");
            (repository, commit)
        };
        let sources = self
            .sources
            .create(repository.clone(), commit.clone(), &config.repo_root)?;
        let failures = sources.failures.clone();
        let prepared = self.provider.prepare(&BaseRequest {
            working_config: config,
            repository,
            commit: commit.clone(),
            sources,
        });
        if let Some(source) = failures.failure() {
            return Err(Error::Base {
                commit: commit.to_string(),
                source: Box::new(Error::SourceFailure { source }),
            });
        }
        let before = match prepared {
            Ok(before) => before,
            Err(source) => {
                return Err(Error::Base {
                    commit: commit.to_string(),
                    source: Box::new(source),
                });
            }
        };
        if let Err(source) = before.render_all() {
            if let Some(source) = failures.failure() {
                return Err(Error::Base {
                    commit: commit.to_string(),
                    source: Box::new(Error::SourceFailure { source }),
                });
            }
            return Err(Error::Base {
                commit: commit.to_string(),
                source: Box::new(Error::Graph { source }),
            });
        }
        let result = self.comparison.compare(
            &ComparisonRequest {
                base_ref: base.into(),
                base_commit: commit.to_string(),
                catalogue_identity: catalogue_key(&relative(&config.file, &config.repo_root))
                    .compare()?,
            },
            before,
            head,
        );
        if let Some(source) = failures.failure() {
            return Err(Error::Base {
                commit: commit.to_string(),
                source: Box::new(Error::SourceFailure { source }),
            });
        }
        result
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
