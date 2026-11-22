//! Native base extraction and dependency selection retain both leases for the runtime.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use mokly_catalogue::config::relative;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_compare::base_freshness::DependencySelection;
use mokly_compare::base_render::BaseRequest;
use mokly_compare::base_sources::BaseSourcesRequest;
use mokly_compare::cache::DiskCache;
use mokly_compare::cache_types::{Cache, Lease, Reporter, Storage};
use mokly_compare::commands::TimedCommands;
use mokly_compare::dependencies::{Dependencies, DependencyTiers};
use mokly_compare::dependency_types::Request;
use mokly_compare::error::{Error, Result};
use mokly_compare::extraction::{CachedExtraction, Extraction};
use mokly_compare::inputs::Inputs;
use mokly_compare::locations::{Locations, SystemLocations};
use mokly_compare::process::SystemSpawner;
use mokly_compare::storage::SystemStorage;
use mokly_git::control::{Cancellation, SystemClock};
use mokly_git::identity::RepoPath;
use mokly_git::tree::Limits;
use mokly_platform::flush::SystemFlush;
use mokly_platform::locks::SystemLocks;
use mokly_platform::processes::SystemProcessGroups;
use mokly_render::side::BaseSide;

use crate::base_dependency_selection::{resolution, tier_number};
use crate::changes_freshness::{PreparedDependencies, SelectionRequest};
use crate::serve_eager_diagnostics::DiagnosticRouting;

#[cfg_attr(test, unimock::unimock(api = BaseDependenciesMock))]
pub(super) trait BaseDependencies: Send + Sync {
    /// Lease the complete extraction of the base commit when one exists, without a build.
    fn existing_sources(&self, request: &BaseSourcesRequest<'_>) -> Result<Option<Arc<Lease>>>;
    /// Extract the discovered sidecar sources and read both clean dependency identities.
    fn sources(
        &self,
        request: &BaseSourcesRequest<'_>,
        existing: Option<Arc<Lease>>,
    ) -> Result<DependencySources>;
    /// Select the dependency tier with exact adopted head evidence.
    fn prepare(
        &self,
        request: &BaseRequest<'_>,
        config: &ResolvedConfig,
        selection: &SelectionRequest<'_>,
        sources: DependencySources,
    ) -> Result<PreparedDependencies>;
}

/// The source and dependency caches of one repository, with their storage and clock.
pub(super) struct Caches {
    pub(super) root: PathBuf,
    pub(super) cache: Arc<dyn Cache>,
    pub(super) storage: Arc<dyn Storage>,
    pub(super) clock: Arc<SystemClock>,
}

/// Extracted sources and clean identities sampled before dependency selection.
pub struct DependencySources {
    /// Extraction remains leased through preparation and capture.
    pub(super) sources: Arc<Lease>,
    /// Historical clean dependency inputs.
    pub(super) base: Inputs,
    /// Working clean dependency inputs.
    pub(super) head: Inputs,
}

pub(super) struct NativeDependencies {
    pub(super) cancellation: Arc<dyn Cancellation>,
    pub(super) reporter: Arc<dyn Reporter>,
    pub(super) routing: Option<Arc<dyn DiagnosticRouting>>,
}

impl BaseDependencies for NativeDependencies {
    fn existing_sources(&self, request: &BaseSourcesRequest<'_>) -> Result<Option<Arc<Lease>>> {
        let caches = self.caches(&request.working_config.repo_root)?;
        let extraction: &dyn Extraction = &CachedExtraction {
            repository: request.repository.clone(),
            cache: caches.cache,
            steps: request.steps.clone(),
            files: Limits::default().files,
        };
        Ok(extraction.existing(&request.commit)?.map(Arc::new))
    }

    fn sources(
        &self,
        request: &BaseSourcesRequest<'_>,
        existing: Option<Arc<Lease>>,
    ) -> Result<DependencySources> {
        match self.prepare_sources(request, existing) {
            Err(Error::Git { source }) if source.is_limit() => Err(Error::Limit {
                path: ".".into(),
                source,
            }),
            Err(Error::CacheLimit { limit }) => Err(Error::Limit {
                path: ".".into(),
                source: mokly_git::error::Error::ByteLimit {
                    limit: limit as usize,
                },
            }),
            result => result,
        }
    }

    fn prepare(
        &self,
        request: &BaseRequest<'_>,
        config: &ResolvedConfig,
        selection: &SelectionRequest<'_>,
        sources: DependencySources,
    ) -> Result<PreparedDependencies> {
        match self.prepare_side(request, config, selection, sources) {
            Err(Error::Git { source }) if source.is_limit() => Err(Error::Limit {
                path: ".".into(),
                source,
            }),
            Err(Error::CacheLimit { limit }) => Err(Error::Limit {
                path: ".".into(),
                source: mokly_git::error::Error::ByteLimit {
                    limit: limit as usize,
                },
            }),
            result => result,
        }
    }
}

impl NativeDependencies {
    /// The repository's source and dependency caches, composed for one preparation.
    pub(super) fn caches(&self, repo_root: &Path) -> Result<Caches> {
        let locations: &dyn Locations = &SystemLocations;
        let root = locations.repository(repo_root)?;
        let clock = Arc::new(SystemClock::default());
        let storage: Arc<dyn Storage> = Arc::new(SystemStorage {
            root: root.clone(),
            cancellation: self.cancellation.clone(),
            flush: Arc::new(SystemFlush),
        });
        let cache: Arc<dyn Cache> = Arc::new(DiskCache {
            root: root.clone(),
            source_bytes: 2 * 1024 * 1024 * 1024,
            dependency_bytes: 2 * 1024 * 1024 * 1024,
            storage: storage.clone(),
            locks: Arc::new(SystemLocks),
            clock: clock.clone(),
            cancellation: self.cancellation.clone(),
            reporter: self.reporter.clone(),
        });
        Ok(Caches {
            root,
            cache,
            storage,
            clock,
        })
    }

    fn prepare_side(
        &self,
        request: &BaseRequest<'_>,
        config: &ResolvedConfig,
        selection_request: &SelectionRequest<'_>,
        sources: DependencySources,
    ) -> Result<PreparedDependencies> {
        let Caches {
            root: cache_namespace,
            cache,
            storage,
            clock,
        } = self.caches(&config.repo_root)?;
        let DependencySources {
            sources,
            base,
            head,
        } = sources;
        let span = tracing::info_span!(
            "review.base-dependencies",
            status = "error",
            tier = tracing::field::Empty
        );
        let _scope = span.enter();
        let selection = selection_request.record.then(|| DependencySelection {
            inputs: head.clone(),
            paths: None,
            directories: selection_request.directories.to_vec(),
            unmapped: selection_request.unmapped.to_vec(),
        });
        let tiers: &dyn Dependencies = &DependencyTiers {
            cache,
            steps: request.steps.clone(),
            storage: storage.clone(),
            clock: clock.clone(),
            timeout: Duration::from_secs(120),
            install_bytes: 2 * 1024 * 1024 * 1024,
            commands: Arc::new(TimedCommands {
                spawner: Arc::new(SystemSpawner {
                    clock: clock.clone(),
                    groups: Arc::new(SystemProcessGroups),
                }),
                clock,
                cancellation: self.cancellation.clone(),
                storage,
            }),
        };
        let configuration = match RepoPath::parse(&relative(&config.file, &config.repo_root)) {
            Ok(path) => path,
            Err(source) => return Err(Error::Git { source }),
        };
        let dependencies = tiers.resolve(&Request {
            base,
            head,
            source_root: sources.directory.clone(),
            used_directories: selection_request.directories.to_vec(),
            unmapped_directories: selection_request.unmapped.to_vec(),
            source_identity: request.commit.to_string(),
            install_scripts: request.install_scripts,
            head_root: config.repo_root.clone(),
            configuration,
            resolution: resolution(config),
        })?;
        span.record("tier", tier_number(dependencies.tier));
        span.record("status", "ok");
        Ok(PreparedDependencies {
            selection,
            side: Arc::new(BaseSide {
                working_root: request.working_config.repo_root.clone(),
                sources,
                dependencies,
                cache_namespace: Some(cache_namespace),
                identity: request.commit.to_string(),
            }),
        })
    }
}

#[cfg(test)]
#[path = "_tests_/base_dependencies_tests.rs"]
mod base_dependencies_tests;
