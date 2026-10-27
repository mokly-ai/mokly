//! Pinned base preparation delegates JavaScript and HTML to one side provider boundary.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::relative;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_git::identity::ObjectId;
use mokly_git::repository::Repository;
use mokly_git::tree::Limits;
use mokly_graph::types::RenderGeneration;
use mokly_model::material::catalogue_key;
use mokly_source_interface::tree::SourceTree;

use crate::base_selection::{BaseLookup, PinnedBase};
use crate::comparison_error::CompareResult;
use crate::comparison_types::{Comparison, ComparisonRequest, ComparisonResult};
use crate::error::{Error, Result};
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
        let install_scripts = install_scripts
            .or_else(|| {
                config
                    .input
                    .review
                    .as_ref()
                    .and_then(|review| review.base_install_scripts)
            })
            .unwrap_or(false);
        let selected = match &self.pinned {
            Some(pinned) => pinned.clone(),
            None => self
                .lookup
                .pin(&config.repo_root, selected_base(config, base))?,
        };
        let base = &selected.reference;
        let repository = selected.repository.clone();
        let commit = selected.commit.clone();
        let (before, failures) = {
            let base_span = tracing::info_span!("review.base-tree", status = "error");
            let _scope = base_span.enter();
            let sources =
                self.sources
                    .create(repository.clone(), commit.clone(), &config.repo_root)?;
            let failures = sources.failures.clone();
            let prepared = self.provider.prepare(&BaseRequest {
                head: head.as_ref(),
                working_config: config,
                repository,
                commit: commit.clone(),
                sources,
                install_scripts,
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
            let before = match self.comparison.capture_base(before) {
                Ok(before) => before,
                Err(source) => {
                    if let Some(source) = failures.failure() {
                        return Err(Error::Base {
                            commit: commit.to_string(),
                            source: Box::new(Error::SourceFailure { source }),
                        });
                    }
                    return Err(Error::Base {
                        commit: commit.to_string(),
                        source: Box::new(source),
                    });
                }
            };
            base_span.record("status", "ok");
            (before, failures)
        };
        let result = self.comparison.compare_prepared(
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
        let mut result = result?;
        result.warnings.extend(failures.warnings());
        mokly_catalogue::diagnostic::normalize_warnings(&mut result.warnings);
        Ok(result)
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
