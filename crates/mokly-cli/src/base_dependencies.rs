//! Native base extraction and dependency selection retain both leases for the runtime.

use std::path::{Component, Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use mokly_catalogue::config::relative;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_compare::base_render::BaseRequest;
use mokly_compare::cache::DiskCache;
use mokly_compare::cache_types::{Cache, Reporter, Storage};
use mokly_compare::commands::TimedCommands;
use mokly_compare::dependencies::{Dependencies, DependencyTiers};
use mokly_compare::dependency_types::{Request, Tier};
use mokly_compare::error::{Error, InternalError, Result};
use mokly_compare::extraction::{CachedExtraction, Extraction};
use mokly_compare::inputs::{InputReader, SourceInputs};
use mokly_compare::locations::{Locations, SystemLocations};
use mokly_compare::process::SystemSpawner;
use mokly_compare::storage::SystemStorage;
use mokly_compare::working_inputs::{SystemWorkingInputs, WorkingInputs};
use mokly_git::control::{Cancellation, SystemClock};
use mokly_git::identity::RepoPath;
use mokly_git::tree::Limits;
use mokly_platform::flush::SystemFlush;
use mokly_platform::locks::SystemLocks;
use mokly_platform::processes::SystemProcessGroups;
use mokly_render::side::BaseSide;
use mokly_sidecar::methods::ModuleResolution;

#[cfg_attr(test, unimock::unimock(api = BaseDependenciesMock))]
pub(super) trait BaseDependencies: Send + Sync {
    fn prepare(
        &self,
        request: &BaseRequest<'_>,
        config: &ResolvedConfig,
        used_directories: &[String],
        unmapped_directories: &[String],
    ) -> Result<Arc<BaseSide>>;
}

pub(super) struct NativeDependencies {
    pub(super) cancellation: Arc<dyn Cancellation>,
    pub(super) reporter: Arc<dyn Reporter>,
}

impl BaseDependencies for NativeDependencies {
    fn prepare(
        &self,
        request: &BaseRequest<'_>,
        config: &ResolvedConfig,
        used_directories: &[String],
        unmapped_directories: &[String],
    ) -> Result<Arc<BaseSide>> {
        match self.prepare_side(request, config, used_directories, unmapped_directories) {
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
    fn prepare_side(
        &self,
        request: &BaseRequest<'_>,
        config: &ResolvedConfig,
        used_directories: &[String],
        unmapped_directories: &[String],
    ) -> Result<Arc<BaseSide>> {
        let locations: &dyn Locations = &SystemLocations;
        let root = locations.repository(&config.repo_root)?;
        let clock = Arc::new(SystemClock::default());
        let storage: Arc<dyn Storage> = Arc::new(SystemStorage {
            root: root.clone(),
            cancellation: self.cancellation.clone(),
            flush: Arc::new(SystemFlush),
        });
        let cache: Arc<dyn Cache> = Arc::new(DiskCache {
            root,
            source_bytes: 2 * 1024 * 1024 * 1024,
            dependency_bytes: 2 * 1024 * 1024 * 1024,
            storage: storage.clone(),
            locks: Arc::new(SystemLocks),
            clock: clock.clone(),
            cancellation: self.cancellation.clone(),
            reporter: self.reporter.clone(),
        });
        let extraction: &dyn Extraction = &CachedExtraction {
            repository: request.repository.clone(),
            cache: cache.clone(),
            files: Limits::default().files,
        };
        let sources = extraction.acquire(&request.commit)?;
        let span = tracing::info_span!(
            "review.base-dependencies",
            status = "error",
            tier = tracing::field::Empty
        );
        let _scope = span.enter();
        let reader: &dyn InputReader = &SourceInputs;
        let base = reader.read(request.sources.sources.as_ref(), Limits::default())?;
        let working: &dyn WorkingInputs = &SystemWorkingInputs;
        let head = working.read(request.repository.as_ref(), &base, Limits::default())?;
        let tiers: &dyn Dependencies = &DependencyTiers {
            cache,
            storage: storage.clone(),
            clock: clock.clone(),
            timeout: Duration::from_secs(120),
            install_bytes: 2 * 1024 * 1024 * 1024,
            commands: Arc::new(TimedCommands {
                spawner: Arc::new(SystemSpawner {
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
            used_directories: used_directories.to_vec(),
            unmapped_directories: unmapped_directories.to_vec(),
            source_identity: request.commit.to_string(),
            install_scripts: request.install_scripts,
            head_root: config.repo_root.clone(),
            configuration,
            resolution: resolution(config)?,
        })?;
        span.record("tier", tier_number(dependencies.tier));
        span.record("status", "ok");
        Ok(Arc::new(BaseSide {
            sources,
            dependencies,
            identity: request.commit.to_string(),
        }))
    }
}

fn tier_number(tier: Tier) -> u64 {
    match tier {
        Tier::Working => 1,
        Tier::Installed => 2,
        Tier::Fallback => 3,
    }
}

fn resolution(config: &ResolvedConfig) -> Result<ModuleResolution> {
    let authored = config.input.module_resolution.clone().unwrap_or_default();
    let loaders = match serde_json::to_value(authored.loaders.unwrap_or_default())
        .and_then(serde_json::from_value)
    {
        Ok(loaders) => loaders,
        Err(source) => return Err(InternalError::Json { source }.into()),
    };
    let directory = config.file.parent().unwrap_or(&config.repo_root);
    Ok(ModuleResolution {
        dependency_root: None,
        aliases: authored.aliases.unwrap_or_default(),
        conditions: authored.conditions.unwrap_or_default(),
        loaders,
        main_fields: authored.main_fields.unwrap_or_default(),
        resolve_extensions: authored.resolve_extensions.unwrap_or_default(),
        package_roots: authored
            .package_roots
            .unwrap_or_default()
            .iter()
            .map(|root| relative(&normalized(&directory.join(root)), &config.repo_root))
            .collect(),
    })
}

fn normalized(path: &Path) -> PathBuf {
    let mut output = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                output.pop();
            }
            component => output.push(component),
        }
    }
    output
}

#[cfg(test)]
#[path = "_tests_/base_dependencies_tests.rs"]
mod base_dependencies_tests;
