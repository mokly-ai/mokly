//! Source discovery and extraction can run before adopted head dependency evidence exists.

use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::discovery::{Discoverer, Discovery, Inventory, SourceKind};
use mokly_cli::cancelled_work::CancellableTree;
use mokly_compare::base_render::{BasePreparationResult, BaseProvider, BaseRequest, PreparedBase};
use mokly_compare::base_sources::BaseSourcesRequest;
use mokly_compare::cache_types::Lease;
use mokly_compare::error::{Error, Result};
use mokly_git::error;
use mokly_git::identity::ObjectId;
use mokly_git::repository::Repository;
use mokly_git::source_key::CheckoutIdentity;
use mokly_graph::styles::local_roots;
use mokly_source_interface::tree::SourceTree;

use crate::base_dependencies::DependencySources;
use crate::changes_base::NativeBase;
use crate::changes_source_admission::{SourceAdmission, SourceCache};

#[cfg_attr(test, unimock::unimock(api = NativePhasesMock))]
pub(super) trait NativePhases: BaseProvider {
    /// Validate a native historical graph without starting comparison document work.
    fn validate(&self, request: &BaseRequest<'_>) -> BasePreparationResult;
    /// Admit document work after completed head usage adopts the native graph.
    fn admit(&self, prepared: PreparedBase) -> BasePreparationResult;
    fn checkout(
        &self,
        repository: &dyn Repository,
        commit: &ObjectId,
    ) -> Result<Option<CheckoutIdentity>>;
    fn sources(
        &self,
        request: &BaseSourcesRequest<'_>,
        checkout: Option<CheckoutIdentity>,
        admission: Option<Arc<dyn SourceAdmission>>,
    ) -> Result<NativeSources>;
    fn validate_sources(
        &self,
        request: &BaseRequest<'_>,
        sources: NativeSources,
    ) -> BasePreparationResult;
}

pub struct NativeSources {
    pub(super) tree: Arc<dyn SourceTree>,
    pub(super) config: ResolvedConfig,
    /// Pending Storybook roots defer discovery until the base side has its dependencies.
    pub(super) inventory: Option<Inventory>,
    pub(super) checkout: Option<CheckoutIdentity>,
    pub(super) dependencies: Option<DependencySources>,
}

impl NativeBase {
    pub(super) fn checkout_sample(
        &self,
        repository: &dyn Repository,
        commit: &ObjectId,
    ) -> Result<Option<CheckoutIdentity>> {
        match &self.freshness {
            Some(_) => match repository.checkout_identity(commit) {
                Ok(checkout) => Ok(Some(checkout)),
                Err(error::Error::Cancelled) => Err(Error::Cancelled),
                Err(error) => {
                    tracing::debug!(%error, "base checkout evidence is unavailable");
                    Ok(None)
                }
            },
            None => Ok(None),
        }
    }

    pub(super) fn source_generation(
        &self,
        request: &BaseSourcesRequest<'_>,
        checkout: Option<CheckoutIdentity>,
        admission: Option<&dyn SourceAdmission>,
    ) -> Result<NativeSources> {
        if self.cancellation.requested() {
            return Err(Error::Cancelled);
        }
        let tree: Arc<dyn SourceTree> = Arc::new(CancellableTree {
            inner: request.sources.tree.clone(),
            cancellation: self.cancellation.clone(),
        });
        let early = self.early_sources(request)?;
        let loader: &dyn ConfigLoader = &Loader { tree: tree.clone() };
        let file = request.working_config.file.to_string_lossy();
        let mut config = if matches!(tree.project(&request.working_config.file), Ok(None)) {
            ResolvedConfig {
                input: Config::default(),
                roots: Vec::new(),
                modules: Default::default(),
                authored_inputs: Vec::new(),
                ..request.working_config.clone()
            }
        } else {
            match loader.load(&request.working_config.repo_root, Some(&file)) {
                Ok(config) => config,
                Err(source) => return Err(Error::Catalogue { source }),
            }
        };
        let working_packages = request.working_config.source_packages();
        if config
            .source_packages()
            .is_some_and(|packages| !packages.is_empty())
            || working_packages.is_some_and(|packages| !packages.is_empty())
        {
            config.modules.working_source_packages =
                Some(working_packages.cloned().unwrap_or_default());
        }
        if let Some(admission) = admission {
            admission.enter(if early.is_some() {
                SourceCache::Leased
            } else {
                SourceCache::Unleased
            })?;
        }
        let inventory = if config.needs_storybook() {
            None
        } else {
            let discovery: &dyn Discovery = &Discoverer { tree: tree.clone() };
            match discovery.discover(&config, None) {
                Ok(inventory) => Some(inventory),
                Err(source) => return Err(Error::Catalogue { source }),
            }
        };
        let needs_sidecar = configured_sidecar(&config)
            || inventory.as_ref().is_none_or(|inventory| {
                inventory.files.iter().any(|file| {
                    !file.excluded && matches!(file.kind, SourceKind::Module | SourceKind::Stories)
                })
            });
        let dependencies = if needs_sidecar {
            Some(self.dependencies.sources(request, early)?)
        } else {
            None
        };
        Ok(NativeSources {
            tree,
            config,
            inventory,
            checkout,
            dependencies,
        })
    }

    /// An existing complete extraction can serve configuration reads without building one.
    fn early_sources(&self, request: &BaseSourcesRequest<'_>) -> Result<Option<Arc<Lease>>> {
        if !configured_sidecar(request.working_config) {
            return Ok(None);
        }
        let attached = self
            .dependencies
            .existing_sources(request)
            .and_then(|lease| match lease {
                Some(lease) => {
                    request.sources.sources.attach(lease.clone())?;
                    Ok(Some(lease))
                }
                None => Ok(None),
            });
        match attached {
            Err(Error::Cancelled) => Err(Error::Cancelled),
            Err(error) => {
                tracing::debug!(%error, "base reads stay on Git before the dependency step");
                Ok(None)
            }
            result => result,
        }
    }
}

fn configured_sidecar(config: &ResolvedConfig) -> bool {
    config.needs_storybook()
        || config.modules.renderer.is_some()
        || config.modules.postcss.is_some()
        || (config.vite() && !local_roots(config, &Default::default()).is_empty())
}

#[cfg(test)]
#[path = "_tests_/changes_base_sources_tests.rs"]
mod changes_base_sources_tests;
